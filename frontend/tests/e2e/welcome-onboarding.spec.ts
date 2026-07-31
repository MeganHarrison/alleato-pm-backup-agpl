import { test, expect } from '../fixtures/index';

async function openForcedOnboarding(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.localStorage.removeItem('alleato_onboarding_completed_v3');
  });
  await page.goto('/?onboarding=1', { waitUntil: 'domcontentloaded' });
}

test.describe('Welcome onboarding', () => {
  test('force-opens, advances, skips, and persists completion', async ({ page }) => {
    await openForcedOnboarding(page);

    await expect(page.getByText(/^Welcome,/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This isn’t testing. This is co-creation.' })).toBeVisible();
    await expect(page.getByText('This is your first look at Alleato’s new AI-powered project platform.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toBeHidden();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Feedback should be one click away.')).toBeVisible();
    await expect(page.getByPlaceholder('Bug, idea, or just confused — anything works')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Alleato AI instead' })).toBeHidden();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Set up your first test project.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Explore later' })).toBeHidden();

    const stored = await page.evaluate(() =>
      window.localStorage.getItem('alleato_onboarding_completed_v3'),
    );
    expect(stored).toBeFalsy();
  });

  test('create project CTA routes to new project form', async ({ page }) => {
    await openForcedOnboarding(page);

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /Create your first test project/ }).click();

    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/\/create-project$/);
  });
});
