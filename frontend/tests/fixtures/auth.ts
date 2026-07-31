import { test as base, request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';

function getAuthToken(): string | null {
  const authFile = path.join(__dirname, '../.auth/user.json');

  if (fs.existsSync(authFile)) {
    try {
      const authState = JSON.parse(fs.readFileSync(authFile, 'utf-8'));

      // First check cookies (Supabase stores auth token in cookies)
      const cookies = authState.cookies || [];
      const authCookie = cookies.find(
        (cookie: { name: string; value: string }) =>
          cookie.name.includes('auth-token') ||
          (cookie.name.includes('sb-') && cookie.name.includes('-auth'))
      );

      if (authCookie) {
        let cookieValue = authCookie.value;
        if (cookieValue.startsWith('base64-')) {
          cookieValue = cookieValue.slice(7);
        }
        try {
          const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          if (parsed.access_token) {
            return parsed.access_token;
          }
        } catch {
          // Try parsing directly
          try {
            const parsed = JSON.parse(cookieValue);
            if (parsed.access_token) {
              return parsed.access_token;
            }
          } catch {
            // Not JSON
          }
        }
      }

      // Fallback to localStorage
      const localStorage = authState.origins?.[0]?.localStorage || [];
      const authItem = localStorage.find((item: { name: string }) => item.name.includes('auth-token'));

      if (authItem) {
        const authData = JSON.parse(authItem.value);
        return authData.access_token;
      }
    } catch (error) {
      console.error('Error reading auth token:', error);
    }
  }
  return null;
}

/**
 * Extend Playwright test to add Bearer token to all API requests
 */
export const test = base.extend({
  request: async ({}, use, testInfo) => {
    const token = getAuthToken();

    // Create new request context with auth header
    // Use port 3100 to match playwright.config.ts webServer setting
    const host = process.env.PLAYWRIGHT_HOST || '127.0.0.1';
    const port = process.env.PLAYWRIGHT_PORT || '3100';
    const context = await playwrightRequest.newContext({
      baseURL: process.env.BASE_URL || `http://${host}:${port}`,
      extraHTTPHeaders: token ? {
        'Authorization': `Bearer ${token}`,
      } : {},
    });

    await use(context);
    await context.dispose();
  },
});

export { expect } from '@playwright/test';
