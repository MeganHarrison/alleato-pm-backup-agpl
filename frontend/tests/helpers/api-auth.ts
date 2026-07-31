/**
 * Helper functions for authenticated API testing with Playwright
 *
 * This module provides utilities for making authenticated API requests in Playwright tests.
 * The approach uses a custom Playwright fixture that creates an API request context
 * with cookies from the storage state.
 */
import { request as baseRequest, type APIRequestContext } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Gets cookies from the storageState file
 */
export function getCookiesFromStorageState(storageStatePath: string): Cookie[] {
  const authFile = path.resolve(storageStatePath);
  const storageState = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  return storageState.cookies || [];
}

/**
 * Creates request options with authentication cookies
 *
 * IMPORTANT: This approach sets cookies as HTTP headers, which may not work with
 * all Next.js server-side authentication patterns. For full compatibility with
 * Next.js cookies(), consider using a browser context instead.
 */
export function withAuth(storageStatePath: string, options: Record<string, unknown> = {}) {
  const cookies = getCookiesFromStorageState(storageStatePath);

  // Convert cookies to Cookie header format
  const cookieHeader = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  return {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      'Cookie': cookieHeader,
    },
  };
}

/**
 * Creates an authenticated API request context using Playwright's storageState
 * to ensure cookies are applied via the request context (avoids Cookie header issues).
 */
type RequestFactory = typeof baseRequest;

export async function createAuthenticatedRequestContext(
  playwright: { request: RequestFactory },
  storageStatePath: string,
  baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL,
    storageState: storageStatePath,
  });
}

/**
 * Makes an authenticated GET request
 */
export async function authenticatedGet(
  request: APIRequestContext,
  url: string,
  storageStatePath: string,
  options: Record<string, unknown> = {}
) {
  return request.get(url, withAuth(storageStatePath, options));
}

/**
 * Makes an authenticated POST request
 */
export async function authenticatedPost(
  request: APIRequestContext,
  url: string,
  storageStatePath: string,
  options: Record<string, unknown> = {}
) {
  return request.post(url, withAuth(storageStatePath, options));
}

/**
 * Makes an authenticated PUT request
 */
export async function authenticatedPut(
  request: APIRequestContext,
  url: string,
  storageStatePath: string,
  options: Record<string, unknown> = {}
) {
  return request.put(url, withAuth(storageStatePath, options));
}

/**
 * Makes an authenticated DELETE request
 */
export async function authenticatedDelete(
  request: APIRequestContext,
  url: string,
  storageStatePath: string,
  options: Record<string, unknown> = {}
) {
  return request.delete(url, withAuth(storageStatePath, options));
}
