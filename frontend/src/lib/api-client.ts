/**
 * Global API fetch wrapper.
 *
 * Every client-side API call should use this instead of raw `fetch()`.
 * It guarantees:
 *   1. JSON error bodies are always parsed (`{ error, details }`)
 *   2. The most specific error message is always surfaced
 *   3. Errors thrown are real Error objects with actionable messages
 *   4. Consistent typing for responses
 *
 * Usage:
 *   import { apiFetch } from "@/lib/api-client";
 *
 *   // Simple — throws on error with real message
 *   const data = await apiFetch<Project>(`/api/projects/${id}`);
 *
 *   // With options
 *   const data = await apiFetch<Project>(`/api/projects/${id}`, {
 *     method: "PUT",
 *     body: JSON.stringify(payload),
 *   });
 *
 *   // DELETE (returns null for 204 No Content)
 *   await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
 */

import { fetchWithTransientRouteRetry } from "@/lib/fetch-with-transient-route-retry";

/** Structured error from our API routes (see lib/api-error.ts) */
export interface ApiErrorBody {
  error?: string;
  details?: unknown;
  message?: string;
  error_code?: string;
  error_message?: string;
  where_it_failed?: string;
  request_id?: string;
}

/**
 * Error class that carries the HTTP status and parsed API error body.
 * Catch blocks can use `err.status`, `err.body`, or just `err.message`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;
  readonly requestId?: string;
  readonly errorCode?: string;
  readonly whereItFailed?: string;

  constructor(status: number, body: ApiErrorBody) {
    const message = getApiErrorMessage(status, body);
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.requestId = body.request_id;
    this.errorCode = body.error_code;
    this.whereItFailed = body.where_it_failed;
  }
}

const browserGetRequestsInFlight = new Map<string, Promise<unknown>>();

function extractOpaqueStructuredMessage(value: string): string | undefined {
  const trimmed = value.trim();
  const messageMatch = trimmed.match(/['"]message['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (!messageMatch?.[1]) return undefined;

  const codeMatch = trimmed.match(/['"]code['"]\s*:\s*['"]?(\d{3,})['"]?/i);
  return codeMatch?.[1]
    ? `${messageMatch[1]} (code ${codeMatch[1]})`
    : messageMatch[1];
}

function sanitizeErrorString(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const structuredMessage = extractOpaqueStructuredMessage(trimmed);
  if (structuredMessage) return structuredMessage;

  const lower = trimmed.toLowerCase();
  const looksLikeHtmlDump =
    lower.includes("<!doctype html") ||
    lower.includes("<html") ||
    lower.includes("cloudflare ray id") ||
    lower.includes("performance & security by cloudflare") ||
    lower.includes("error code 522");

  if (looksLikeHtmlDump) {
    return undefined;
  }

  return trimmed;
}

function stringifyErrorDetails(details: ApiErrorBody["details"]): string | undefined {
  if (typeof details === "string" && details.trim()) {
    return sanitizeErrorString(details);
  }

  if (Array.isArray(details)) {
    const joined = details
      .map((detail) => {
        const location = detail.path || detail.field;
        if (location && detail.message) {
          return `${location}: ${detail.message}`;
        }
        return detail.message;
      })
      .filter((detail): detail is string => Boolean(detail && detail.trim()))
      .join("; ");

    return joined || undefined;
  }

  if (details && typeof details === "object") {
    const objectDetails = details as Record<string, unknown>;
    if (typeof objectDetails.message === "string") {
      const message = sanitizeErrorString(objectDetails.message);
      if (message) return message;
    }

    if (typeof objectDetails.error === "string") {
      const message = sanitizeErrorString(objectDetails.error);
      if (message) return message;
    }

    if (typeof objectDetails.details === "string") {
      const message = sanitizeErrorString(objectDetails.details);
      if (message) return message;
    }

    const fieldErrors = objectDetails.fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const joined = Object.entries(fieldErrors as Record<string, unknown>)
        .flatMap(([field, messages]) => {
          if (Array.isArray(messages)) {
            return messages
              .filter((message): message is string => typeof message === "string")
              .map((message) => `${field}: ${message}`);
          }
          return typeof messages === "string" ? [`${field}: ${messages}`] : [];
        })
        .join("; ");
      if (joined) return joined;
    }

    const formErrors = objectDetails.formErrors;
    if (Array.isArray(formErrors)) {
      const joined = formErrors
        .filter((message): message is string => typeof message === "string")
        .join("; ");
      if (joined) return joined;
    }

    // Plain diagnostic object (e.g. { inputId }) — not a structured field-error.
    // Return undefined so getApiErrorMessage falls through to body.message / body.error.
    return undefined;
  }

  return undefined;
}

function getApiErrorMessage(status: number, body: ApiErrorBody): string {
  const normalizedError = typeof body.error === "string" ? sanitizeErrorString(body.error) : undefined;
  const normalizedErrorMessage =
    typeof body.error_message === "string" ? sanitizeErrorString(body.error_message) : undefined;
  const normalizedMessage = typeof body.message === "string" ? sanitizeErrorString(body.message) : undefined;

  const raw = `${normalizedError ?? body.error ?? ""} ${normalizedErrorMessage ?? body.error_message ?? ""} ${normalizedMessage ?? body.message ?? ""}`.toLowerCase();
  if (
    status === 413 ||
    raw.includes("request entity too large") ||
    raw.includes("payload too large") ||
    raw.includes("function_payload_too_large")
  ) {
    return "Upload is too large for the server request limit. Reduce file size and try again.";
  }

  return (
    stringifyErrorDetails(body.details) ||
    normalizedErrorMessage ||
    normalizedError ||
    normalizedMessage ||
    `Request failed (HTTP ${status})`
  );
}

// Supabase auth lock coordinator emits these when another tab steals the token-refresh lock — operational noise, not bugs.
const LOCK_NOISE_PATTERNS = [
  "lock broken by another request",
  "lock was stolen by another request",
  'lock "lock:sb-',
  "was released because another",
];

function reportApiFailure(url: string, status: number, body: ApiErrorBody): void {
  // 401/403 are user-state, not application errors — do not pollute telemetry
  if (typeof window === "undefined" || url.includes("/api/app-error-events") || status === 401 || status === 403) {
    return;
  }

  // Supabase cross-tab lock contention messages are library internals, not app errors
  const errorMessage = getApiErrorMessage(status, body).toLowerCase();
  if (LOCK_NOISE_PATTERNS.some((pattern) => errorMessage.includes(pattern))) {
    return;
  }

  void import("@/lib/app-error-reporter")
    .then(({ reportBrowserError }) => {
      reportBrowserError({
        source: "client",
        severity: status >= 500 ? "high" : "medium",
        route: url,
        action: "api_fetch",
        errorCode: body.error_code ?? `HTTP_${status}`,
        errorMessage: getApiErrorMessage(status, body),
        requestId: body.request_id,
        statusCode: status,
        context: {
          where_it_failed: body.where_it_failed,
          details: body.details,
        },
      });
    })
    .catch(() => {
      // Telemetry must never affect the caller's error handling path.
    });
}

/**
 * Fetch wrapper that guarantees meaningful error messages.
 *
 * - On success: returns parsed JSON (or null for 204).
 * - On failure: throws `ApiError` with the actual error message from the server.
 *
 * Never shows "Failed to X" — always shows the real reason.
 */
export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const cacheMode = init?.cache;
  const canDedupeBrowserGet =
    typeof window !== "undefined" &&
    method === "GET" &&
    !init?.body &&
    !init?.signal &&
    cacheMode !== "no-store" &&
    cacheMode !== "reload";

  if (canDedupeBrowserGet) {
    const headers = new Headers(init?.headers);
    const cacheKey = JSON.stringify({
      url,
      credentials: init?.credentials ?? "same-origin",
      cache: cacheMode ?? "default",
      headers: Array.from(headers.entries()).sort(),
    });
    const inFlight = browserGetRequestsInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight as Promise<T>;
    }

    const requestPromise = performApiFetch<T>(url, init, (requestUrl, requestInit) =>
      fetch(requestUrl, requestInit),
    ).finally(() => {
      browserGetRequestsInFlight.delete(cacheKey);
    });
    browserGetRequestsInFlight.set(cacheKey, requestPromise);
    return requestPromise;
  }

  return performApiFetch<T>(url, init, (requestUrl, requestInit) =>
    fetch(requestUrl, requestInit),
  );
}

/**
 * Fetch wrapper with a client-side timeout.
 * Throws an Error with a descriptive message if the request exceeds `timeoutMs`.
 * Use for form submissions where a hung request would leave the UI stuck.
 */
export async function apiFetchWithTimeout<T = unknown>(
  url: string,
  init?: RequestInit,
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await performApiFetch<T>(url, { ...init, signal: controller.signal }, (u, i) =>
      fetch(u, i),
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch wrapper with transient route retry for dev-time module compilation races.
 * Use for idempotent GET/HEAD requests when first-hit Next.js route compilation
 * may intermittently return a temporary 500.
 */
export async function apiFetchWithTransientRouteRetry<T = unknown>(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; delayMs?: number },
): Promise<T> {
  return performApiFetch<T>(url, init, (requestUrl, requestInit) =>
    fetchWithTransientRouteRetry(requestUrl, requestInit, options),
  );
}

async function performApiFetch<T>(
  url: string,
  init: RequestInit | undefined,
  request: (url: string, init: RequestInit | undefined) => Promise<Response>,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await request(url, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  });

  // 204 No Content (typical DELETE response)
  if (response.status === 204) {
    return null as T;
  }

  // Success — parse JSON
  if (response.ok) {
    // Some endpoints return empty body on success
    const text = await response.text();
    if (!text) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // Error — parse the JSON error body from our API routes
  const raw = await response.text().catch(() => "");
  let body: ApiErrorBody;
  try {
    const json = raw ? JSON.parse(raw) : {};
    body = {
      error: json.error,
      details: json.details,
      message: json.message,
      error_code: json.error_code,
      error_message: json.error_message,
      where_it_failed: json.where_it_failed,
      request_id: json.request_id || response.headers.get("x-request-id") || undefined,
    };
  } catch {
    // Response wasn't JSON — preserve raw text so callers see the real server message.
    body = {
      error: raw || `Request failed (HTTP ${response.status})`,
      request_id: response.headers.get("x-request-id") || undefined,
    };
  }

  reportApiFailure(url, response.status, body);
  throw new ApiError(response.status, body);
}

/**
 * Fetch wrapper for binary responses (e.g. PDFs).
 * Throws ApiError with parsed server details on non-2xx responses.
 */
export async function apiFetchBlob(
  url: string,
  init?: RequestInit,
): Promise<Blob> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  });

  if (response.ok) {
    return response.blob();
  }

  const raw = await response.text().catch(() => "");
  let body: ApiErrorBody;
  try {
    const json = raw ? JSON.parse(raw) : {};
    body = {
      error: json.error,
      details: json.details,
      message: json.message,
      error_code: json.error_code,
      error_message: json.error_message,
      where_it_failed: json.where_it_failed,
      request_id: json.request_id || response.headers.get("x-request-id") || undefined,
    };
  } catch {
    body = {
      error: raw || `Request failed (HTTP ${response.status})`,
      request_id: response.headers.get("x-request-id") || undefined,
    };
  }

  reportApiFailure(url, response.status, body);
  throw new ApiError(response.status, body);
}

/**
 * Raw fetch wrapper for endpoints that return non-standard HTTP status codes
 * (e.g. 207 Multi-Status for bulk operations). Returns the raw Response so the
 * caller can inspect status codes that apiFetch would otherwise throw on.
 *
 * Only use this when the endpoint intentionally returns a non-2xx/non-204 status
 * as part of its normal protocol. For everything else, use apiFetch.
 */
export async function apiFetchRaw(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers,
  });
}

/**
 * Helper for bulk operations with Promise.allSettled.
 * Extracts the actual error message from the first rejection.
 *
 * Usage:
 *   const results = await Promise.allSettled(ids.map(id => apiFetch(...)));
 *   const { succeeded, failed, firstError } = summarizeBulkResults(results);
 *
 *   if (succeeded > 0) toast.success(`${succeeded} items deleted`);
 *   if (failed > 0)    toast.error(firstError);
 */
export function summarizeBulkResults<T>(results: PromiseSettledResult<T>[]) {
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<T> => r.status === "fulfilled",
  );
  const rejected = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );

  const firstError = rejected.length > 0
    ? rejected[0].reason instanceof Error
      ? rejected[0].reason.message
      : String(rejected[0].reason)
    : undefined;

  return {
    succeeded: fulfilled.length,
    failed: rejected.length,
    firstError: firstError || "Unknown error",
    allErrors: rejected.map((r) =>
      r.reason instanceof Error ? r.reason.message : String(r.reason),
    ),
  };
}
