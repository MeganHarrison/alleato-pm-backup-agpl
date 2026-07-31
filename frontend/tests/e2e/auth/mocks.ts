import type { Page } from '@playwright/test';

export async function setupUnauthenticatedMocks(page: Page): Promise<void> {
  await page.route('**/auth/v1/user*', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized' }),
    });
  });
}

export async function setupAgentAPIMocks(page: Page): Promise<void> {
  await page.route('**/api/pydantic-agent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: '{"text":"Mock response"}\n{"complete":true,"session_id":"session-auth","conversation_title":"Auth"}',
    });
  });
}

export async function setupModuleMocks(page: Page): Promise<void> {
  await page.route('**/api/modules**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/agents**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}
