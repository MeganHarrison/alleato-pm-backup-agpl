import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const PID = 67;

// Each tool: [name, path, expectedHeadingPattern]
const TOOLS = [
  ["Budget", `${BASE}/${PID}/budget`, /budget/i],
  ["Prime Contracts", `${BASE}/${PID}/prime-contracts`, /prime contract/i],
  ["Commitments", `${BASE}/${PID}/commitments`, /commitment/i],
  ["Change Events", `${BASE}/${PID}/change-events`, /change event/i],
  ["Change Orders", `${BASE}/${PID}/change-orders`, /change order/i],
  ["Direct Costs", `${BASE}/${PID}/direct-costs`, /direct cost/i],
  ["Invoicing", `${BASE}/${PID}/invoicing`, /invoic/i],
] as const;

for (const [toolName, url, headingPattern] of TOOLS) {
  test(`${toolName}: page loads and shows heading`, async ({ page }) => {
    await page.goto(url);
    await page.waitForLoadState("domcontentloaded");
    
    // Must not redirect to login
    expect(page.url()).not.toContain("/auth/login");
    
    // Must show a heading matching the tool name
    const heading = page.locator("h1,h2").filter({ hasText: headingPattern }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    
    // Must not show a "Loading..." spinner that never resolves
    await page.waitForTimeout(3000);
    const persistentLoaders = page.getByText(/^loading\.\.\.$/i);
    const count = await persistentLoaders.count();
    expect(count, `${toolName}: Persistent loading spinner detected`).toBe(0);
    
    console.log(`✓ ${toolName}: page loaded at ${page.url()}`);
  });
}
