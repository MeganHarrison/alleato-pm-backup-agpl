/**
 * Redacts credentials and sensitive query parameters from URLs before logging.
 *
 * Vendored from OpenClaw `packages/net-policy/src/redact-sensitive-url.ts`
 * (MIT License, Copyright (c) 2026 OpenClaw Foundation —
 * https://github.com/openclaw/openclaw). Trimmed: the OpenClaw config-UI hint
 * helpers (`isSensitiveUrlConfigPath`, `hasSensitiveUrlHintTag`,
 * `SENSITIVE_URL_HINT_TAG`) were dropped — they referenced OpenClaw's config
 * system and have no consumer in Alleato.
 */

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

const SENSITIVE_URL_QUERY_PARAM_NAMES = new Set([
  "token",
  "key",
  "api_key",
  "apikey",
  "secret",
  "access_token",
  "auth_token",
  "password",
  "pass",
  "passwd",
  "auth",
  "jwt",
  "session",
  "id_token",
  "code",
  "client_secret",
  "app_secret",
  "hook_token",
  "refresh_token",
  "signature",
  "x_amz_signature",
  "x_amz_security_token",
  "private_key",
  "credential",
  "authorization",
]);
// Hangul fillers are Unicode category Lo, so \p{C}\p{Z} alone would let them
// splice sensitive key names. Strip those code points (U+115F, U+1160, U+3164,
// U+FFA0) and "+" too.
const URL_QUERY_NAME_SEPARATOR_RE = /[\p{C}\p{Z}ᅟᅠㅤﾠ+]/gu;

function normalizeUrlQueryParamName(name: string): string {
  const stripped = name.replace(URL_QUERY_NAME_SEPARATOR_RE, "");
  try {
    return normalizeLowercaseStringOrEmpty(
      decodeURIComponent(stripped).replace(URL_QUERY_NAME_SEPARATOR_RE, ""),
    ).replaceAll("-", "_");
  } catch {
    return normalizeLowercaseStringOrEmpty(stripped).replaceAll("-", "_");
  }
}

/** True for auth-like URL query parameter names that should be redacted. */
export function isSensitiveUrlQueryParamName(name: string): boolean {
  const normalized = normalizeUrlQueryParamName(name);
  return SENSITIVE_URL_QUERY_PARAM_NAMES.has(normalized);
}

/** Redacts credentials and sensitive query params from parseable URLs. */
export function redactSensitiveUrl(value: string): string {
  try {
    const parsed = new URL(value);
    let mutated = false;
    if (parsed.username || parsed.password) {
      parsed.username = parsed.username ? "***" : "";
      parsed.password = parsed.password ? "***" : "";
      mutated = true;
    }
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (isSensitiveUrlQueryParamName(key)) {
        parsed.searchParams.set(key, "***");
        mutated = true;
      }
    }
    return mutated ? parsed.toString() : value;
  } catch {
    return value;
  }
}

/** Redacts sensitive URL-looking substrings even when the full value is not a valid URL. */
export function redactSensitiveUrlLikeString(value: string): string {
  const redactedUrl = redactSensitiveUrl(value);
  if (redactedUrl !== value) {
    return redactedUrl;
  }
  return value
    .replace(/\/\/([^@/?#\s]+)@/g, "//***:***@")
    .replace(/([?&])([^=&]+)=([^&]*)/g, (match, prefix: string, key: string) =>
      isSensitiveUrlQueryParamName(key) ? `${prefix}${key}=***` : match,
    );
}
