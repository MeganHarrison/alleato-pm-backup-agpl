import { test, expect } from '@playwright/test';

test('seed', async ({ page }) => {
  await page.goto('http://localhost:3000/31/change-events');
});
