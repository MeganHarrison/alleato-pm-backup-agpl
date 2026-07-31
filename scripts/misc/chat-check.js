import { chromium } from "playwright";

const CHAT_URL = "http://localhost:3003/chat";
const EXPECTED_TITLE = "Alleato chat assistant";
const AGENT_HINT = "Set OPENAI_AGENT_ID";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(CHAT_URL, { waitUntil: "networkidle" });
    await page.waitForSelector(`text=${EXPECTED_TITLE}`, { timeout: 10000 });

    await page.fill("textarea[name='chat-input']", "Test agent availability");
    await page.click("button:has-text('Send message')");
    await page.waitForTimeout(250);
    await page.waitForSelector(`text=${AGENT_HINT}`, { timeout: 10000 });

    console.log("Chat page renders and surfaces the agent configuration hint.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Playwright chat check failed:", error);
  process.exit(1);
});
