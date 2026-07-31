import type { Page } from '@playwright/test';

export async function setupAllMocks(page: Page): Promise<void> {
  await page.route('**/auth/v1/user*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-123',
        email: 'test@example.com',
        user_metadata: { full_name: 'Test User' },
      }),
    });
  });

  await page.route('**/api/conversations**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'conv-1',
          title: 'Test Conversation 1',
          created_at: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/pydantic-agent', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: '{"text":"Hello! I\'m a mock AI assistant."}\n{"complete":true,"session_id":"session-new","conversation_title":"New Chat"}',
    });
  });
}
