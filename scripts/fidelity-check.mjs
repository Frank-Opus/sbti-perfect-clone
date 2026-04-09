import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outputDir = resolve(rootDir, ".fidelity-output");
const localPort = 4173;
const localUrl = `http://127.0.0.1:${localPort}/`;
const allUrls = {
  source: "https://sbti.unun.dev/",
  local: localUrl,
  prod: "https://sbti-perfect-clone.vercel.app/",
};
const includeProd = process.argv.includes("--include-prod");
const urls = includeProd
  ? allUrls
  : {
      source: allUrls.source,
      local: allUrls.local,
    };

const viewports = {
  desktop: { width: 1440, height: 1400 },
  mobile: { width: 390, height: 1200 },
  result: { width: 1440, height: 2400 },
};

const answerProfiles = {
  all_first: () => 0,
  all_second: () => 1,
  all_third: () => 2,
  by_question_id: (questionId) => {
    const n = Number(questionId.replace(/\D+/g, ""));
    return Number.isFinite(n) ? (n - 1) % 3 : 0;
  },
};

function hashBuffer(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

function hashText(text) {
  return createHash("md5").update(text ?? "").digest("hex");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function gotoWithRetry(page, url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForLoadState("networkidle", { timeout: 90000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(1500 * attempt);
      }
    }
  }
  throw lastError;
}

async function waitForHttp(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (response.ok) return;
    } catch {
      // Retry until timeout.
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startLocalServer() {
  const child = spawn("python3", ["-m", "http.server", String(localPort)], {
    cwd: rootDir,
    stdio: "ignore",
  });
  return child;
}

async function captureHome(page, url, viewport, label) {
  await page.setViewportSize(viewport);
  await gotoWithRetry(page, url);
  const shot = await page.screenshot({ fullPage: true });
  return {
    label,
    title: await page.title(),
    h1: await page.locator("h1").textContent(),
    screenshotHash: hashBuffer(shot),
  };
}

async function answerQuiz(page, picker) {
  await page.getByRole("button", { name: "开始测试" }).click();
  await page.waitForSelector(".question");
  const questions = page.locator(".question");
  const count = await questions.count();
  for (let i = 0; i < count; i++) {
    const question = questions.nth(i);
    const firstRadio = question.locator('input[type="radio"]').first();
    const name = (await firstRadio.getAttribute("name")) ?? "";
    const radios = question.locator('input[type="radio"]');
    const radioCount = await radios.count();
    const optionIndex = Math.min(picker(name), radioCount - 1);
    await radios.nth(optionIndex).check();
  }
  const unanswered = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".question"))
      .map((question) => {
        const checked = question.querySelector('input[type="radio"]:checked');
        const name = question
          .querySelector('input[type="radio"]')
          ?.getAttribute("name");
        return checked || !name ? null : name;
      })
      .filter(Boolean);
  });
  for (const name of unanswered) {
    const radios = page.locator(`input[name="${name}"]`);
    const optionIndex = Math.min(picker(name), (await radios.count()) - 1);
    await radios.nth(optionIndex).check();
  }
  if (await page.getByRole("button", { name: "提交并查看结果" }).isDisabled()) {
    const stillUnanswered = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".question"))
        .map((question, idx) => {
          const checked = question.querySelector('input[type="radio"]:checked');
          const name = question
            .querySelector('input[type="radio"]')
            ?.getAttribute("name");
          const text = question
            .querySelector(".question-title")
            ?.textContent?.slice(0, 80);
          return checked || !name ? null : { idx, name, text };
        })
        .filter(Boolean);
    });
    throw new Error(
      `Quiz automation left unanswered questions: ${JSON.stringify(
        stillUnanswered
      )}`
    );
  }
  await page.getByRole("button", { name: "提交并查看结果" }).click();
  await page.waitForSelector("#result.screen.active");
  await page.waitForFunction(() => {
    const img = document.getElementById("posterImage");
    return !!img && img.complete && img.naturalWidth > 0;
  });
}

async function captureResult(page, url, profileName, picker) {
  await page.setViewportSize(viewports.result);
  await gotoWithRetry(page, url);
  await answerQuiz(page, picker);
  const shot = await page.screenshot({ fullPage: true });
  return {
    profileName,
    type: await page.locator("#resultTypeName").textContent(),
    badge: await page.locator("#matchBadge").textContent(),
    textHash: hashText(await page.locator("#result").innerText()),
    screenshotHash: hashBuffer(shot),
  };
}

function compareFields(groupName, baseline, candidate, fields, mismatches) {
  for (const field of fields) {
    if (baseline[field] !== candidate[field]) {
      mismatches.push({
        group: groupName,
        field,
        expected: baseline[field],
        actual: candidate[field],
      });
    }
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const localServer = startLocalServer();
  let serverStarted = false;
  try {
    await waitForHttp(localUrl);
    serverStarted = true;

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    const homeResults = {};
    for (const [viewportName, viewport] of Object.entries({
      desktop: viewports.desktop,
      mobile: viewports.mobile,
    })) {
      homeResults[viewportName] = {};
      for (const [envName, url] of Object.entries(urls)) {
        const page = await context.newPage();
        homeResults[viewportName][envName] = await captureHome(
          page,
          url,
          viewport,
          `${envName}-${viewportName}`
        );
        await page.close();
      }
    }

    const resultResults = {};
    for (const [profileName, picker] of Object.entries(answerProfiles)) {
      resultResults[profileName] = {};
      for (const [envName, url] of Object.entries(urls)) {
        const page = await context.newPage();
        resultResults[profileName][envName] = await captureResult(
          page,
          url,
          profileName,
          picker
        );
        await page.close();
      }
    }

    await browser.close();

    const mismatches = [];
    for (const viewportName of Object.keys(homeResults)) {
      const source = homeResults[viewportName].source;
      compareFields(
        `home:${viewportName}:local`,
        source,
        homeResults[viewportName].local,
        ["title", "h1", "screenshotHash"],
        mismatches
      );
      if (homeResults[viewportName].prod) {
        compareFields(
          `home:${viewportName}:prod`,
          source,
          homeResults[viewportName].prod,
          ["title", "h1", "screenshotHash"],
          mismatches
        );
      }
    }

    for (const profileName of Object.keys(resultResults)) {
      const source = resultResults[profileName].source;
      compareFields(
        `result:${profileName}:local`,
        source,
        resultResults[profileName].local,
        ["type", "badge", "textHash", "screenshotHash"],
        mismatches
      );
      if (resultResults[profileName].prod) {
        compareFields(
          `result:${profileName}:prod`,
          source,
          resultResults[profileName].prod,
          ["type", "badge", "textHash", "screenshotHash"],
          mismatches
        );
      }
    }

    const summary = {
      homeResults,
      resultResults,
      mismatches,
    };
    console.log(JSON.stringify(summary, null, 2));

    if (mismatches.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (serverStarted) {
      localServer.kill("SIGTERM");
    } else {
      localServer.kill("SIGKILL");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
