import { test, expect, type Page } from '@playwright/test';

type HomeState = 'home' | 'login' | 'unknown';
type ProjectHomeState = 'project_home' | 'login' | 'notfound' | 'unknown';

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

async function detectHomeState(page: Page): Promise<HomeState> {
  const hasLogin = await page.getByRole('button', { name: /login/i }).isVisible().catch(() => false);
  const hasEmail = await page.getByRole('textbox', { name: /email/i }).isVisible().catch(() => false);
  if (hasLogin && hasEmail) return 'login';

  const hasProjectSearch = await page.getByRole('textbox', { name: /search projects/i }).isVisible().catch(() => false);
  const hasProjectsHeading = await page.getByRole('heading', { name: /projects/i }).isVisible().catch(() => false);
  const hasNoProjects = await page.getByRole('heading', { name: /no projects found/i }).isVisible().catch(() => false);
  if (hasProjectSearch || hasProjectsHeading || hasNoProjects) return 'home';

  return 'unknown';
}

async function detectProjectHomeState(page: Page): Promise<ProjectHomeState> {
  const hasLogin = await page.getByRole('button', { name: /login/i }).isVisible().catch(() => false);
  const hasEmail = await page.getByRole('textbox', { name: /email/i }).isVisible().catch(() => false);
  if (hasLogin && hasEmail) return 'login';

  const has404 = await page.getByRole('heading', { name: '404' }).isVisible().catch(() => false);
  if (has404) return 'notfound';

  const hasProjectHeader = await page.getByRole('link', { name: /projects/i }).first().isVisible().catch(() => false);
  const hasPlanningToggle = await page.getByRole('button', { name: /planning/i }).isVisible().catch(() => false);
  const hasFinanceToggle = await page.getByRole('button', { name: /finance/i }).isVisible().catch(() => false);
  const hasProjectTitle = await page.getByRole('heading', { level: 1 }).isVisible().catch(() => false);
  const isProjectHomeUrl = /\/\d+\/home/.test(page.url());
  if (
    (hasProjectHeader && (hasPlanningToggle || hasFinanceToggle)) ||
    (isProjectHomeUrl && (hasProjectTitle || hasPlanningToggle || hasFinanceToggle))
  ) {
    return 'project_home';
  }

  return 'unknown';
}

async function waitForState<T extends string>(
  page: Page,
  detect: (target: Page) => Promise<T>,
  acceptable: T[],
): Promise<T> {
  for (let i = 0; i < 20; i += 1) {
    const state = await detect(page);
    if (acceptable.includes(state)) return state;
    await page.waitForTimeout(500);
  }
  return detect(page);
}

test.describe('Comprehensive Page Check', () => {
  test('home page renders valid no-auth state', async ({ page }) => {
    await gotoWithRetry(page, '/');

    const state = await waitForState(page, detectHomeState, ['home', 'login']);
    expect(['home', 'login']).toContain(state);
  });

  test('home shell controls render when home is visible', async ({ page }) => {
    await gotoWithRetry(page, '/');

    const state = await waitForState(page, detectHomeState, ['home', 'login']);
    expect(['home', 'login']).toContain(state);

    if (state === 'login') {
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
      return;
    }

    await expect(page.getByRole('textbox', { name: /search projects/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();
  });

  test('project home route renders valid no-auth state', async ({ page }) => {
    await gotoWithRetry(page, '/67/home');

    const state = await waitForState(page, detectProjectHomeState, ['project_home', 'login', 'notfound']);
    expect(['project_home', 'login', 'notfound']).toContain(state);

    if (state === 'login') {
      await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
      return;
    }

    if (state === 'notfound') {
      await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
      return;
    }

    await expect(page.getByRole('button', { name: /planning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /finance/i })).toBeVisible();
  });
});
