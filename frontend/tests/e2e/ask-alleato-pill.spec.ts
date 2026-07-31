import { test, expect } from '../fixtures/index';

test.describe('Ask Alleato widget', () => {
  test('feedback pill opens the client feedback composer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.localStorage.setItem('alleato_onboarding_completed_v3', new Date().toISOString()));
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: 'Feedback mode' }).click();
    await expect(page.getByRole('heading', { name: 'Submit Admin Feedback' })).toBeVisible();
    await expect(page.getByText('Feedback type')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByText('Feedback will be attached to this part of the page automatically.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Capture|Capturing|Retake/ })).toBeVisible();
  });

  test('keyboard shortcut opens the widget', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('alleato_onboarding_completed_v3', new Date().toISOString());
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Feedback mode' })).toBeVisible();
    await page.waitForFunction(() => (
      document.documentElement.dataset.askAlleatoShortcutReady === 'true'
    ));
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'i',
        ctrlKey: true,
        bubbles: true,
      }));
    });
    await expect(page.getByRole('tab', { name: 'Alleato AI' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByPlaceholder('Ask anything about your projects...')).toBeVisible();
  });
});
