import type { APIRequestContext } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Loads auth cookies from storage state and applies them to the request context
 * This is necessary because the Playwright request fixture doesn't automatically
 * inherit cookies from storageState like browser contexts do.
 */
export async function applyAuthCookies(request: APIRequestContext): Promise<void> {
  const storageStatePath = join(__dirname, '../../../tests/.auth/user.json');
  const storageState = JSON.parse(readFileSync(storageStatePath, 'utf-8'));

  // Extract cookies and create a Cookie header
  const cookies = storageState.cookies || [];
  const cookieHeader = cookies
    .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  // Store for use in requests
  (request as any).__authCookies = cookieHeader;
}

/**
 * Gets the auth cookies as a Cookie header string
 */
export function getAuthCookies(request: APIRequestContext): string {
  return (request as any).__authCookies || '';
}
