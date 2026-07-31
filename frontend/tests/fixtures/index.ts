/**
 * Universal Test Fixtures for Alleato-Procore
 *
 * This file provides standardized fixtures that solve common testing issues:
 * - Authentication: Auto-injects Bearer tokens for API requests
 * - Navigation: Uses domcontentloaded instead of networkidle
 *
 * USAGE: Import from this file instead of @playwright/test
 *
 * ```typescript
 * // Before (broken):
 * import { test, expect } from '@playwright/test';
 *
 * // After (works):
 * import { test, expect } from '../fixtures';
 * ```
 *
 * @see .agents/patterns/solutions/auth-fixture-pattern.md
 * @see .agents/patterns/solutions/domcontentloaded-pattern.md
 */

import {
  test as base,
  expect,
  request as playwrightRequest,
  Page,
  APIRequestContext,
  APIResponse,
} from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Types
// ============================================================================

interface AuthenticatedRequest {
  get: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  post: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  put: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  patch: (url: string, options?: RequestOptions) => Promise<APIResponse>;
  delete: (url: string, options?: RequestOptions) => Promise<APIResponse>;
}

interface RequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number>;
  form?: Record<string, string | number | boolean>;
}

interface AuthFixtures {
  /** Pre-authenticated API request methods with Bearer token */
  authenticatedRequest: AuthenticatedRequest;
  /** Raw auth token for custom use */
  authToken: string | null;
  /** Navigate to URL with domcontentloaded (not networkidle) */
  safeNavigate: (url: string) => Promise<void>;
  /** Navigate and wait for specific element */
  navigateAndWaitFor: (
    url: string,
    selector: string,
    options?: { timeout?: number }
  ) => Promise<void>;
}

interface AuthStateData {
  token: string | null;
  cookieHeader: string | null;
}

// ============================================================================
// Auth Token Extraction
// ============================================================================

/**
 * Extracts the Supabase access token from stored auth state.
 * Handles multiple token name formats and storage locations used by Supabase.
 */
function getAuthState(): AuthStateData {
  try {
    // Try multiple possible auth file locations
    const possiblePaths = [
      path.join(__dirname, '../.auth/user.json'),
      path.join(__dirname, '../../tests/.auth/user.json'),
      path.join(process.cwd(), 'tests/.auth/user.json'),
    ];

    let authPath: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        authPath = p;
        break;
      }
    }

    if (!authPath) {
      console.warn('Auth state file not found. Run auth setup first.');
      return { token: null, cookieHeader: null };
    }

    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

    // First, check cookies (Supabase stores auth token in cookies)
    // Cookie format: sb-<project-ref>-auth-token with base64-encoded JSON value
    const cookies = auth.cookies || [];
    const authCookie = cookies.find(
      (cookie: { name: string; value: string }) =>
        cookie.name.includes('auth-token') ||
        (cookie.name.includes('sb-') && cookie.name.includes('-auth'))
    );

    const cookieHeader =
      cookies.length > 0
        ? cookies.map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`).join('; ')
        : null;

    if (authCookie) {
      // Cookie value is base64-encoded JSON prefixed with "base64-"
      let cookieValue = authCookie.value;
      if (cookieValue.startsWith('base64-')) {
        cookieValue = cookieValue.slice(7); // Remove "base64-" prefix
      }
      try {
        const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) {
          return { token: parsed.access_token, cookieHeader };
        }
      } catch {
        // Try parsing directly if not base64
        try {
          const parsed = JSON.parse(cookieValue);
          if (parsed.access_token) {
            return { token: parsed.access_token, cookieHeader };
          }
        } catch {
          // Not JSON, might be raw token
        }
      }
    }

    // Fallback: check localStorage
    // Supabase uses different naming patterns:
    // - sb-<project-ref>-auth-token
    // - supabase-auth-token
    const localStorage = auth.origins?.[0]?.localStorage || [];
    const tokenItem = localStorage.find(
      (item: { name: string; value: string }) =>
        item.name.includes('auth-token') ||
        item.name.includes('access-token') ||
        (item.name.includes('sb-') && item.name.includes('-auth'))
    );

    if (!tokenItem) {
      console.warn('Auth token not found in storage state (checked cookies and localStorage)');
      return { token: null, cookieHeader };
    }

    // Token value might be JSON (contains access_token) or raw string
    try {
      const parsed = JSON.parse(tokenItem.value);
      return { token: parsed.access_token || parsed.token || null, cookieHeader };
    } catch {
      // Value is likely the raw token
      return { token: tokenItem.value, cookieHeader };
    }
  } catch (error) {
    console.error('Error reading auth token:', error);
    return { token: null, cookieHeader: null };
  }
}

// ============================================================================
// Extended Test Fixture
// ============================================================================

export const test = base.extend<AuthFixtures>({
  /**
   * Raw auth token for custom use cases
   */
  authToken: async ({}, use) => {
    const authState = getAuthState();
    await use(authState.token);
  },

  /**
   * Pre-authenticated request context with Bearer token.
   *
   * Use this for API tests:
   * ```typescript
   * test('api test', async ({ authenticatedRequest }) => {
   *   const response = await authenticatedRequest.get('/api/projects');
   *   expect(response.ok()).toBe(true);
   * });
   * ```
   */
  authenticatedRequest: async ({}, use) => {
    const authState = getAuthState();
    const authHeaders: Record<string, string> = authState.token
      ? { Authorization: `Bearer ${authState.token}` }
      : {};

    if (authState.cookieHeader) {
      authHeaders.Cookie = authState.cookieHeader;
    }

    // Create a context with the base URL
    const baseURL = process.env.BASE_URL || 'http://localhost:3000';
    const context = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: authHeaders,
    });

    const makeRequest = async (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      url: string,
      options: RequestOptions = {}
    ): Promise<APIResponse> => {
      const { data, headers = {}, params, form } = options;

      const requestOptions: Record<string, unknown> = {
        headers: { ...authHeaders, ...headers },
      };

      if (data !== undefined) {
        requestOptions.data = data;
      }

      if (params) {
        requestOptions.params = params;
      }

      if (form) {
        requestOptions.form = form;
      }

      return context[method](url, requestOptions);
    };

    const wrappedRequest: AuthenticatedRequest = {
      get: (url, options) => makeRequest('get', url, options),
      post: (url, options) => makeRequest('post', url, options),
      put: (url, options) => makeRequest('put', url, options),
      patch: (url, options) => makeRequest('patch', url, options),
      delete: (url, options) => makeRequest('delete', url, options),
    };

    await use(wrappedRequest);
    await context.dispose();
  },

  /**
   * Navigate to URL using domcontentloaded (NOT networkidle).
   *
   * ALWAYS use this instead of:
   * ```typescript
   * await page.goto(url);
   * await page.waitForLoadState('networkidle'); // DON'T DO THIS
   * ```
   *
   * @see .agents/patterns/errors/networkidle-timeout.md
   */
  safeNavigate: async ({ page }, use) => {
    const navigate = async (url: string): Promise<void> => {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
    };
    await use(navigate);
  },

  /**
   * Navigate and wait for a specific element to appear.
   *
   * Use when you need to verify page content loaded:
   * ```typescript
   * await navigateAndWaitFor('/projects', '[data-testid="project-list"]');
   * ```
   */
  navigateAndWaitFor: async ({ page }, use) => {
    const navigate = async (
      url: string,
      selector: string,
      options: { timeout?: number } = {}
    ): Promise<void> => {
      const { timeout = 30000 } = options;
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      await page.locator(selector).waitFor({ state: 'visible', timeout });
    };
    await use(navigate);
  },
});

// Re-export everything from @playwright/test for convenience
export { expect };
export type { Page, APIRequestContext, APIResponse };

// ============================================================================
// Standalone Helper Functions
// ============================================================================

/**
 * Navigate safely without using the fixture (for use in helpers)
 */
export async function safeNavigate(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Navigate and wait for element (standalone version)
 */
export async function navigateAndWaitFor(
  page: Page,
  url: string,
  selector: string,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 30000 } = options;
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await page.locator(selector).waitFor({ state: 'visible', timeout });
}

/**
 * Wait for data to load (use instead of networkidle)
 */
export async function waitForDataLoad(
  page: Page,
  options: {
    loadingSelector?: string;
    dataSelector?: string;
    timeout?: number;
  } = {}
): Promise<void> {
  const {
    loadingSelector = '[data-loading="true"], .skeleton, .loading',
    dataSelector,
    timeout = 30000,
  } = options;

  // Wait for any loading indicators to disappear
  const loader = page.locator(loadingSelector);
  if ((await loader.count()) > 0 && (await loader.first().isVisible())) {
    await loader.first().waitFor({ state: 'hidden', timeout });
  }

  // Optionally wait for specific data element
  if (dataSelector) {
    await page.locator(dataSelector).waitFor({ state: 'visible', timeout });
  }
}
