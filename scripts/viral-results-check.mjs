import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const localPort = 4174;
const localUrl = `http://127.0.0.1:${localPort}/`;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
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
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startLocalServer() {
  return spawn("python3", ["-m", "http.server", String(localPort)], {
    cwd: rootDir,
    stdio: "ignore",
  });
}

async function answerQuiz(page) {
  await page.getByRole("button", { name: /开始/ }).click();
  await page.waitForSelector(".question");

  let previousCount = -1;
  while (true) {
    const questions = page.locator(".question");
    const count = await questions.count();
    if (count === previousCount) break;
    previousCount = count;

    for (let i = 0; i < count; i++) {
      const question = questions.nth(i);
      const checked = await question.locator('input[type="radio"]:checked').count();
      if (checked > 0) continue;
      await question.locator('input[type="radio"]').first().check();
    }
  }

  await page.getByRole("button", { name: /提交/ }).click();
  await page.waitForSelector("#result.screen.active");
}

function ensureTruthy(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`Expected non-empty value for ${label}`);
  }
}

async function main() {
  const server = startLocalServer();
  try {
    await waitForHttp(localUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
    await page.goto(localUrl, { waitUntil: "networkidle" });
    await answerQuiz(page);

    const mainType = await page.locator("#resultTypeName").textContent();
    const comboDiagnosis = await page.locator("#comboDiagnosis").textContent();
    const comboPrimary = await page.locator("#comboPrimaryTag").textContent();
    const comboSecondary = await page.locator("#comboSecondaryTag").textContent();
    const nemesis = await page.locator("#nemesisCard").innerText();
    const imageStates = await page.evaluate(() => {
      return ["primaryComboCard", "secondaryComboCard", "nemesisCard"].map((id) => {
        const img = document.querySelector(`#${id} img`);
        return {
          id,
          exists: !!img,
          width: img?.naturalWidth ?? 0,
          src: img?.getAttribute("src") ?? ""
        };
      });
    });

    ensureTruthy(mainType, "mainType");
    ensureTruthy(comboDiagnosis, "comboDiagnosis");
    ensureTruthy(comboPrimary, "comboPrimary");
    ensureTruthy(comboSecondary, "comboSecondary");
    ensureTruthy(nemesis, "nemesis");

    if (!comboDiagnosis.includes("+") || !comboDiagnosis.includes("确诊")) {
      throw new Error(`Unexpected combo diagnosis copy: ${comboDiagnosis}`);
    }

    for (const item of imageStates) {
      if (!item.exists || item.width <= 0 || !item.src) {
        throw new Error(`Missing viral image for ${item.id}: ${JSON.stringify(item)}`);
      }
    }

    await browser.close();
    console.log("viral-results-check: ok");
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
