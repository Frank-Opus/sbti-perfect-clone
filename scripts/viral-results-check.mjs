import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const localPort = 4174;
const localUrl = `http://127.0.0.1:${localPort}/`;
const expectedMilestones = ["进度 25%", "进度 50%", "进度 75%"];

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

function pickStrategy(name, index, radioCount) {
  switch (name) {
    case "all-first":
      return 0;
    case "all-second":
      return Math.min(1, radioCount - 1);
    case "all-third":
      return Math.min(2, radioCount - 1);
    case "all-fourth":
      return Math.min(3, radioCount - 1);
    case "cycle":
      return index % radioCount;
    default:
      return 0;
  }
}

async function dismissStageModalIfVisible(page, milestonesSeen) {
  const modal = page.locator("#stageModal.open");
  if (!(await modal.isVisible().catch(() => false))) {
    return;
  }

  const kicker = (await page.locator("#stageModalKicker").textContent())?.trim() ?? "";
  const title = (await page.locator("#stageModalTitle").textContent())?.trim() ?? "";
  const copy = (await page.locator("#stageModalCopy").textContent())?.trim() ?? "";
  milestonesSeen.push({ kicker, title, copy });

  await page.getByRole("button", { name: /继续/ }).click();
  await page.waitForFunction(() => !document.getElementById("stageModal")?.classList.contains("open"));
}

async function answerQuiz(page, strategyName) {
  const milestonesSeen = [];
  await page.getByRole("button", { name: /开始/ }).click();
  await page.waitForSelector(".question");

  const questionCount = await page.locator(".question").count();
  if (questionCount !== 28) {
    throw new Error(`Expected 28 questions, received ${questionCount}`);
  }

  for (let i = 0; i < questionCount; i++) {
    const question = page.locator(".question").nth(i);
    const radios = question.locator('input[type="radio"]');
    const radioCount = await radios.count();
    const optionIndex = pickStrategy(strategyName, i, radioCount);
    await radios.nth(optionIndex).check();
    await dismissStageModalIfVisible(page, milestonesSeen);
  }

  await dismissStageModalIfVisible(page, milestonesSeen);

  if (await page.getByRole("button", { name: /提交/ }).isDisabled()) {
    throw new Error(`Submit button remained disabled for strategy ${strategyName}`);
  }

  const progressText = (await page.locator("#progressText").textContent())?.trim();
  if (progressText !== "28 / 28") {
    throw new Error(`Unexpected progress text before submit: ${progressText}`);
  }

  await page.getByRole("button", { name: /提交/ }).click();
  await page.waitForSelector("#result.screen.active");
  await page.waitForFunction(() => {
    const poster = document.getElementById("posterImage");
    return !!poster && poster.complete && poster.naturalWidth > 0;
  });

  return milestonesSeen;
}

function ensureTruthy(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`Expected non-empty value for ${label}`);
  }
}

async function verifyResult(page, strategyName, milestonesSeen) {
  const title = await page.title();
  const hero = await page.locator("h1").textContent();
  const mainType = await page.locator("#resultTypeName").textContent();
  const comboDiagnosis = await page.locator("#comboDiagnosis").textContent();
  const comboPrimary = await page.locator("#comboPrimaryTag").textContent();
  const comboSecondary = await page.locator("#comboSecondaryTag").textContent();
  const dimCount = await page.locator("#dimList .dim-item").count();
  const funNote = await page.locator("#funNote").textContent();

  const imageStates = await page.evaluate(() => {
    return ["posterImage", "primaryComboCard", "secondaryComboCard", "nemesisCard"].map((id) => {
      const img = id === "posterImage"
        ? document.getElementById(id)
        : document.querySelector(`#${id} img`);
      return {
        id,
        exists: !!img,
        width: img?.naturalWidth ?? 0,
        src: img?.getAttribute("src") ?? "",
      };
    });
  });

  ensureTruthy(title, "title");
  ensureTruthy(hero, "hero");
  ensureTruthy(mainType, "mainType");
  ensureTruthy(comboDiagnosis, "comboDiagnosis");
  ensureTruthy(comboPrimary, "comboPrimary");
  ensureTruthy(comboSecondary, "comboSecondary");
  ensureTruthy(funNote, "funNote");

  if (!title.includes("赛博发疯标签系统")) {
    throw new Error(`Unexpected title: ${title}`);
  }

  if (!hero.includes("赛博")) {
    throw new Error(`Unexpected hero heading: ${hero}`);
  }

  if (!/^[A-Z-]+（.+）$/.test(mainType.trim())) {
    throw new Error(`Unexpected result type format: ${mainType}`);
  }

  if (!comboDiagnosis.includes("确诊为")) {
    throw new Error(`Unexpected combo diagnosis copy: ${comboDiagnosis}`);
  }

  if (dimCount !== 4) {
    throw new Error(`Expected 4 module cards, received ${dimCount}`);
  }

  if (milestonesSeen.length !== 3) {
    throw new Error(`Expected 3 stage modals, received ${milestonesSeen.length} for ${strategyName}`);
  }

  const seenKickers = milestonesSeen.map((item) => item.kicker);
  for (const expected of expectedMilestones) {
    if (!seenKickers.includes(expected)) {
      throw new Error(`Missing milestone ${expected} for ${strategyName}: ${JSON.stringify(seenKickers)}`);
    }
  }

  for (const item of imageStates) {
    if (!item.exists || item.width <= 0 || !item.src) {
      throw new Error(`Missing viral image for ${item.id}: ${JSON.stringify(item)}`);
    }
  }
}

async function runScenario(browser, strategyName) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } });
  await page.goto(localUrl, { waitUntil: "networkidle" });
  const milestonesSeen = await answerQuiz(page, strategyName);
  await verifyResult(page, strategyName, milestonesSeen);
  const resultType = (await page.locator("#resultTypeName").textContent())?.trim();
  await page.close();
  return { strategyName, resultType };
}

async function main() {
  const server = startLocalServer();
  try {
    await waitForHttp(localUrl);

    const browser = await chromium.launch({ headless: true });
    const strategies = ["all-first", "all-second", "all-third", "all-fourth", "cycle"];
    const results = [];

    for (const strategyName of strategies) {
      results.push(await runScenario(browser, strategyName));
    }

    await browser.close();
    console.log("viral-results-check: ok");
    for (const result of results) {
      console.log(`${result.strategyName}: ${result.resultType}`);
    }
  } finally {
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
