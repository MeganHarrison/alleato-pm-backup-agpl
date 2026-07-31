/**
 * Strips username/password credentials from a URL string.
 *
 * Vendored from OpenClaw `packages/net-policy/src/url-userinfo.ts` (MIT License,
 * Copyright (c) 2026 OpenClaw Foundation — https://github.com/openclaw/openclaw).
 */

/** Strip username/password credentials from a URL string when it parses. */
export function stripUrlUserInfo(value: string): string {
  try {
    const parsed = new URL(value);
    if (!parsed.username && !parsed.password) {
      return value;
    }
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return value;
  }
}
