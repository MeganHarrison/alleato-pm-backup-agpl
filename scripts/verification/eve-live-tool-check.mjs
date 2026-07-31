import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

function option(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const baseUrl = option("base-url", "http://localhost:3012");
const toolName = option("tool");
const prompt = option("prompt");
const existingSessionId = option("session-id");
const authState = option("auth-state");
const completionTimeoutMs = Number(option("completion-timeout-ms", "180000"));
const evidenceDir = option(
  "evidence-dir",
  path.join(process.cwd(), "output", "eve-tool-verification"),
);

if (!toolName || (!prompt && !existingSessionId)) {
  throw new Error(
    "Required: --tool <name> and either --prompt <prompt> or --session-id <id>",
  );
}
if (!Number.isFinite(completionTimeoutMs) || completionTimeoutMs < 10_000) {
  throw new Error("--completion-timeout-ms must be a number of at least 10000.");
}

await fs.mkdir(evidenceDir, { recursive: true });

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function collectToolEvidence(value, matches = [], trail = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectToolEvidence(item, matches, [...trail, index]),
    );
    return matches;
  }
  if (!value || typeof value !== "object") return matches;

  const record = value;
  const identifiesTool =
    record.toolName === toolName ||
    record.name === toolName ||
    record.type === `tool-${toolName}`;
  if (identifiesTool) {
    matches.push({ trail, value });
  }
  for (const [key, item] of Object.entries(value)) {
    collectToolEvidence(item, matches, [...trail, key]);
  }
  return matches;
}

function containsOutputError(value) {
  if (Array.isArray(value)) return value.some(containsOutputError);
  if (!value || typeof value !== "object") return false;
  if (value.state === "output-error" || value.__toolError === true) return true;
  for (const child of Object.values(value)) {
    if (containsOutputError(child)) return true;
  }
  return false;
}

function targetToolFailed(value) {
  if (!value || typeof value !== "object") return false;
  if (value.state === "output-error") return true;
  const output = value.output;
  return Boolean(
    output &&
      typeof output === "object" &&
      (("error" in output && output.error) ||
        output.success === false ||
        output.__toolError === true),
  );
}

function containsBlankSourceLabel(value) {
  if (Array.isArray(value)) return value.some(containsBlankSourceLabel);
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (
      /^(sourceLabel|source_label)$/i.test(key) &&
      (typeof child !== "string" || child.trim() === "")
    ) {
      return true;
    }
    if (containsBlankSourceLabel(child)) return true;
  }
  return false;
}

function normalizeVisibleText(value) {
  return String(value ?? "")
    .replace(/[#*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const browser = await chromium.launch({
  headless: false,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

let activePage = null;
try {
  const contextOptions = {
    viewport: { width: 1440, height: 1000 },
  };
  if (await fileExists(authState)) contextOptions.storageState = authState;

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  activePage = page;
  const targetUrl = existingSessionId
    ? `${baseUrl}/ai?session=${encodeURIComponent(existingSessionId)}`
    : `${baseUrl}/ai`;
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });

  if (/login|sign-in|auth/i.test(page.url())) {
    const email = process.env.TEST_USER_1;
    const password = process.env.TEST_PASSWORD_1;
    if (!email || !password) {
      throw new Error("Authentication expired and TEST_USER_1/TEST_PASSWORD_1 are unavailable.");
    }
    // Wait for React hydration so submitting the form invokes signInWithPassword
    // instead of the browser's native GET form fallback.
    await page.waitForTimeout(3_000);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#email").waitFor({ state: "visible" });
    await page.getByRole("button", { name: /^Sign in$/i }).click();
    await page.waitForFunction(
      () => {
        const loginError = document.querySelector("#login-error");
        return (
          location.pathname !== "/auth/login" ||
          (loginError && loginError.getClientRects().length > 0)
        );
      },
      null,
      { timeout: 60_000 },
    );
    if (page.url().includes("/auth/login")) {
      throw new Error(
        `Login failed: ${await page.locator("#login-error").innerText()}`,
      );
    }
    if (authState) await context.storageState({ path: authState });
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
  }

  const submit = page.getByRole("button", { name: /^Submit$/i });
  let sessionId = existingSessionId;
  if (!sessionId) {
    const input = page.getByPlaceholder(/Ask anything/i).first();
    await input.waitFor({ state: "visible", timeout: 60_000 });
    await submit.waitFor({ state: "visible", timeout: 30_000 });
    // The AI shell re-renders once profile/project queries settle. Verify the
    // controlled textarea retains the prompt before clicking its submit button.
    let composerReady = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await input.fill(prompt);
      await page.waitForTimeout(750);
      composerReady =
        (await input.inputValue()) === prompt && (await submit.isEnabled());
      if (composerReady) break;
      await page.waitForTimeout(1_500);
    }
    if (!composerReady) {
      throw new Error("AI composer did not retain the prompt after page hydration.");
    }
    await submit.click();

    await page.waitForURL(/session=/, { timeout: 60_000 });
    sessionId = new URL(page.url()).searchParams.get("session");
  }
  if (!sessionId) throw new Error("Eve did not create a session URL.");

  const messagesUrl = `${baseUrl}/api/ai-assistant/messages/${sessionId}?surface=alleato_ai`;
  let payload = null;
  let toolMatches = [];
  let visibleFailure = false;
  let uiCompletedAt = null;
  const deadline = Date.now() + completionTimeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2_000);
    const response = await page.evaluate(async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const result = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        return {
          ok: result.ok,
          status: result.status,
          body: await result.text(),
        };
      } catch (error) {
        return {
          ok: false,
          status: 0,
          body: error instanceof Error ? error.message : String(error),
        };
      } finally {
        clearTimeout(timer);
      }
    }, messagesUrl);
    if (response.ok) {
      try {
        payload = JSON.parse(response.body);
      } catch {
        payload = null;
      }
    }
    toolMatches = collectToolEvidence(payload);
    const hasAssistant = JSON.stringify(payload).includes('"role":"assistant"');
    const hasTerminalTool = toolMatches.some(
      ({ value }) => value.state === "output-available",
    );
    const currentBody = await page.locator("body").innerText();
    visibleFailure =
      /request failed|internal_error|precondition_failed|error_message/i.test(
        currentBody,
      );
    if (visibleFailure) break;
    if (hasAssistant && hasTerminalTool) break;
    const submitEnabled = await submit
      .isEnabled({ timeout: 1_000 })
      .catch(() => false);
    if (hasAssistant && submitEnabled) {
      uiCompletedAt ??= Date.now();
      if (Date.now() - uiCompletedAt > 5_000) break;
    } else {
      uiCompletedAt = null;
    }
  }

  const rawPath = path.join(evidenceDir, `${toolName}-trace.json`);
  await fs.writeFile(rawPath, JSON.stringify(payload, null, 2), "utf8");

  const assistantContent = Array.isArray(payload?.messages)
    ? [...payload.messages]
        .reverse()
        .find((message) => message?.role === "assistant")?.content
    : null;
  const assistantVisibleNeedle =
    typeof assistantContent === "string"
      ? normalizeVisibleText(assistantContent).slice(0, 60)
      : "";
  if (assistantVisibleNeedle) {
    await page
      .waitForFunction(
        (needle) =>
          document.body.innerText
            .replace(/[#*_`>|]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .includes(needle),
        assistantVisibleNeedle,
        { timeout: 30_000 },
      )
      .catch(() => {});
  }
  const bodyText = await page.locator("body").innerText();
  const normalizedBodyText = normalizeVisibleText(bodyText);
  const visibleAssistantContent =
    assistantVisibleNeedle.length > 0 &&
    normalizedBodyText.includes(assistantVisibleNeedle);
  visibleFailure =
    visibleFailure ||
    /request failed|internal_error|precondition_failed|error_message/i.test(
      bodyText,
    );
  const hasAssistant = JSON.stringify(payload).includes('"role":"assistant"');
  const hasTerminalTool = toolMatches.some(
    ({ value }) => value.state === "output-available",
  );
  const hasToolFailure =
    containsOutputError(payload) ||
    toolMatches.some(({ value }) => targetToolFailed(value));
  const hasBlankSourceLabel = containsBlankSourceLabel(payload);
  const strictPass =
    Boolean(payload) &&
    hasAssistant &&
    hasTerminalTool &&
    !hasToolFailure &&
    !hasBlankSourceLabel &&
    visibleAssistantContent &&
    !visibleFailure;
  const screenshotPath = path.join(
    evidenceDir,
    `${toolName}-${strictPass ? "passed" : "failure"}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 10_000 });
  const result = {
    toolName,
    sessionId,
    pageUrl: page.url(),
    messagesUrl,
    screenshotPath,
    rawPath,
    toolMatchCount: toolMatches.length,
    visibleToolName: bodyText.includes(toolName),
    visibleFailure,
    hasAssistant,
    hasTerminalTool,
    hasToolFailure,
    hasBlankSourceLabel,
    visibleAssistantContent,
    strictPass,
    assistantTextTail: bodyText.slice(-4000),
  };
  console.log(JSON.stringify(result, null, 2));

  if (!strictPass) {
    process.exitCode = 2;
  }
} catch (error) {
  if (activePage) {
    const failurePath = path.join(evidenceDir, `${toolName}-failure.png`);
    await activePage
      .screenshot({ path: failurePath, fullPage: true, timeout: 10_000 })
      .catch(() => {});
    console.error(
      JSON.stringify(
        {
          toolName,
          failurePath,
          pageUrl: activePage.url(),
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
  }
  process.exitCode = 1;
} finally {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  process.exit(process.exitCode ?? 0);
}
