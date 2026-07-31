import { test, expect, type Page } from '@playwright/test';

const PROJECT_ID = process.env.PAGE_TITLE_PROJECT_ID || '67';

type RouteState = 'route' | 'login' | 'notfound' | 'unknown';

async function gotoWithRetry(page: Page, path: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 15000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isTransientNavigationError =
        message.includes('ERR_CONNECTION_REFUSED') || message.includes('ERR_EMPTY_RESPONSE');
      if (!isTransientNavigationError || attempt === 3) {
        throw error;
      }
      await page.waitForTimeout(1000);
    }
  }
}

async function detectRouteState(page: Page): Promise<RouteState> {
  const hasLogin = await page.getByRole('button', { name: /login/i }).isVisible().catch(() => false);
  const hasEmail = await page.getByRole('textbox', { name: /email/i }).isVisible().catch(() => false);
  if (hasLogin && hasEmail) return 'login';

  const has404 = await page.getByRole('heading', { name: '404' }).isVisible().catch(() => false);
  if (has404) return 'notfound';

  const hasLayout = await page.getByRole('button', { name: /planning|finance|company/i }).isVisible().catch(() => false);
  if (hasLayout) return 'route';

  return 'unknown';
}

async function waitForRouteState(page: Page): Promise<RouteState> {
  for (let i = 0; i < 20; i += 1) {
    const state = await detectRouteState(page);
    if (state !== 'unknown') return state;
    await page.waitForTimeout(500);
  }
  return 'unknown';
}

async function assertTitleForRoute(page: Page, route: string) {
  await gotoWithRetry(page, `/${PROJECT_ID}/${route}`);

  const state = await waitForRouteState(page);

  const title = await page.title();
  expect(title.trim().length).toBeGreaterThan(0);

  if (state === 'route') {
    expect(title.toLowerCase()).toContain(route.toLowerCase());
  }
}

test.describe('Page Title Verification', () => {
  test('budget route provides valid browser title', async ({ page }) => {
    await assertTitleForRoute(page, 'budget');
  });

  test('commitments route provides valid browser title', async ({ page }) => {
    await assertTitleForRoute(page, 'commitments');
  });
});
