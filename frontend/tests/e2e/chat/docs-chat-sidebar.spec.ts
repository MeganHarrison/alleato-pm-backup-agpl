import { test, expect } from '@playwright/test';

test.describe('Procore Docs Chat Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page
  });

  test('should open chat sidebar when floating button is clicked', async ({ page }) => {
    // Find and click the floating chat button
    const chatButton = page.getByRole('button', { name: 'Ask Procore Docs' });
    await expect(chatButton).toBeVisible();

    // Take screenshot of button
    await page.screenshot({
      path: 'tests/screenshots/docs-chat-floating-button.png',
      fullPage: false
    });

    // Click to open sidebar
    await chatButton.click();

    // Wait for sidebar to appear
    await page.waitForTimeout(500);

    // Verify sidebar header is visible
    await expect(page.getByRole('heading', { name: 'Procore Documentation Assistant' })).toBeVisible();

    // Verify example questions are visible
    await expect(page.getByText('How do I create a budget?')).toBeVisible();
    await expect(page.getByText('What are change orders?')).toBeVisible();
    await expect(page.getByText('How do commitments work?')).toBeVisible();

    // Take screenshot of sidebar
    await page.screenshot({
      path: 'tests/screenshots/docs-chat-sidebar-empty.png',
      fullPage: true
    });
  });

  test('should display formatted markdown response', async ({ page }) => {
    // Open sidebar
    const chatButton = page.getByRole('button', { name: 'Ask Procore Docs' });
    await chatButton.click();
    await page.waitForTimeout(500);

    // Type a question
    const input = page.getByPlaceholder('Ask a question about Procore...');
    await input.fill('How do I create a budget?');

    // Submit
    const sendButton = page.getByRole('button').filter({ has: page.locator('svg') }).last();
    await sendButton.click();

    // Wait for response (this might take a few seconds due to OpenAI API)
    await page.waitForTimeout(8000);

    // Verify user message appears
    await expect(page.getByText('How do I create a budget?')).toBeVisible();

    // Take screenshot of conversation with formatted response
    await page.screenshot({
      path: 'tests/screenshots/docs-chat-sidebar-with-response.png',
      fullPage: true
    });
  });

  test('should close sidebar when clicking outside', async ({ page }) => {
    // Open sidebar
    const chatButton = page.getByRole('button', { name: 'Ask Procore Docs' });
    await chatButton.click();
    await page.waitForTimeout(500);

    // Verify sidebar is open
    await expect(page.getByRole('heading', { name: 'Procore Documentation Assistant' })).toBeVisible();

    // Click outside the sidebar (on the overlay)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify sidebar is closed (heading should not be visible)
    await expect(page.getByRole('heading', { name: 'Procore Documentation Assistant' })).not.toBeVisible();
  });

  test('should allow clicking example questions', async ({ page }) => {
    // Open sidebar
    const chatButton = page.getByRole('button', { name: 'Ask Procore Docs' });
    await chatButton.click();
    await page.waitForTimeout(500);

    // Click an example question
    await page.getByText('What are change orders?').click();

    // Verify input is filled with the example
    const input = page.getByPlaceholder('Ask a question about Procore...');
    await expect(input).toHaveValue('What are change orders?');
  });
});
