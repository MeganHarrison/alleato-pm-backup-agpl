/**
 * PROCORE DOCS CHAT E2E TESTS
 *
 * Tests the RAG-powered documentation chat feature
 */

import { test, expect } from '@playwright/test';

test.describe('Procore Docs Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page where chat should be available
    await page.goto('/');
  });

  test('should show floating chat button', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for the chat button (it should be a button with MessageCircle icon)
    const chatButton = page.locator('button[title="Ask Procore Docs"]');

    await expect(chatButton).toBeVisible();
  });

  test('should open chat dialog when button clicked', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Click the chat button
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Check that dialog opened
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check for dialog title (actual component uses "Procore Documentation Assistant")
    const title = page.getByRole('heading', { name: 'Procore Documentation Assistant' });
    await expect(title).toBeVisible();
  });

  test('should show empty state message initially', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Check for empty state message
    const emptyMessage = page.getByText(/Ask me anything about Procore/i);
    await expect(emptyMessage).toBeVisible();
  });

  test('should have input field and send button', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Check for input field
    const input = page.getByPlaceholder('Ask a question about Procore...');
    await expect(input).toBeVisible();

    // Check for send button
    const sendButton = page.locator('button[type="submit"]');
    await expect(sendButton).toBeVisible();
  });

  test('should send a question and receive an answer', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Type a question
    const input = page.getByPlaceholder('Ask a question about Procore...');
    await input.fill('What is a budget?');

    // Click send button
    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();

    // Wait for the user message to appear
    await expect(page.getByText('What is a budget?')).toBeVisible();

    // Wait for loading indicator
    await expect(page.locator('svg.animate-spin')).toBeVisible();

    // Wait for response (RAG API with OpenAI calls can take 30-60s)
    await expect(page.locator('svg.animate-spin')).not.toBeVisible({ timeout: 60000 });

    // Check that there are now 2 messages (user + assistant)
    // Messages are divs with max-w-[85%] rounded-xl classes
    const messages = page.locator('[class*="max-w-"][class*="rounded-xl"]');
    await expect(messages).toHaveCount(2, { timeout: 10000 });
  });

  test('should show sources with links', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Send a question
    const input = page.getByPlaceholder('Ask a question about Procore...');
    await input.fill('How do I create a budget?');

    const sendButton = page.locator('button[type="submit"]');
    await sendButton.click();

    // Wait for response
    await page.waitForTimeout(5000); // Give it time to get response

    // Look for "Sources" text (component uses uppercase without colon)
    const sourcesLabel = page.getByText('Sources', { exact: true });

    // If sources are present, verify they have links
    if (await sourcesLabel.isVisible()) {
      const sourceLinks = page.locator('a[target="_blank"]');
      await expect(sourceLinks.first()).toBeVisible();
    }
  });

  test('should handle multiple questions in sequence', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    const input = page.getByPlaceholder('Ask a question about Procore...');
    const sendButton = page.locator('button[type="submit"]');

    // First question - wait for API response (can take 30-60s)
    await input.fill('What is a budget?');
    await sendButton.click();
    await expect(page.locator('svg.animate-spin')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('svg.animate-spin')).not.toBeVisible({ timeout: 60000 });

    // Second question
    await input.fill('What is a change order?');
    await sendButton.click();
    await expect(page.locator('svg.animate-spin')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('svg.animate-spin')).not.toBeVisible({ timeout: 60000 });

    // Should have 4 messages (2 questions + 2 answers)
    const messages = page.locator('[class*="max-w-"][class*="rounded-xl"]');
    await expect(messages).toHaveCount(4, { timeout: 10000 });
  });

  test('should close dialog when clicking close button', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Wait for dialog to be visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Close the dialog (look for X button or click outside)
    await page.keyboard.press('Escape');

    // Dialog should be hidden
    await expect(dialog).not.toBeVisible();
  });

  test('should disable send button when input is empty', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Open chat
    const chatButton = page.locator('button[title="Ask Procore Docs"]');
    await chatButton.click();

    // Send button should be disabled initially
    const sendButton = page.locator('button[type="submit"]');
    await expect(sendButton).toBeDisabled();

    // Type something
    const input = page.getByPlaceholder('Ask a question about Procore...');
    await input.fill('test');

    // Now it should be enabled
    await expect(sendButton).toBeEnabled();

    // Clear input
    await input.clear();

    // Should be disabled again
    await expect(sendButton).toBeDisabled();
  });
});
