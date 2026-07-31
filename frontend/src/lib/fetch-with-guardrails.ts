/**
 * fetchWithGuardrails — the standard wrapper for all external HTTP calls from API routes.
 *
 * Enforces:
 * - Configurable timeout (default 10s)
 * - Retry with exponential backoff on 5xx and network errors
 * - Structured error output (GuardrailError with UPSTREAM_FAILURE / UPSTREAM_TIMEOUT codes)
 * - Request ID propagation via x-request-id header
 * - Structured logging on success, retry, and failure
 *
 * Usage:
 *   import { fetchWithGuardrails, AI_CALL_POLICY, WRITE_POLICY } from "@/lib/fetch-with-guardrails";
 *
 *   const res = await fetchWithGuardrails("https://alleato-backend-rbnj.onrender.com/api/foo", {
 *     method: "POST",
 *     body: JSON.stringify(payload),
 *     requestId,
 *     where: "route/my-route",
 *     dependency: "python-backend",
 *   });
 *   const data = await res.json();
 */

import {
  fetchWithPolicy,
  type DependencyPolicy,
} from "@/lib/guardrails/dependency";
import { GuardrailError } from "@/lib/guardrails/errors";
import { checkUrlEgress, redactSensitiveUrl } from "@/lib/net-policy";

export interface FetchWithGuardrailsOptions extends RequestInit {
  /** x-request-id from the parent request — propagated to upstream service */
  requestId: string;
  /** Human-readable name of the calling route (for logs/alerts) */
  where: string;
  /** Human-readable name of the dependency being called */
  dependency?: string;
  /** Timeout in ms. Defaults to 10_000. Use 30_000 for AI/LLM calls. */
  timeoutMs?: number;
  /** Max retry attempts on 5xx + network errors. Defaults to 2. Use 0 for non-idempotent writes. */
  retries?: number;
  /** Backoff between retries in ms. Defaults to 400. */
  backoffMs?: number;
  /**
   * SSRF egress: by default, requests to a literal private/loopback/link-local/
   * reserved/cloud-metadata IP host are blocked and throw a GuardrailError.
   * Set true ONLY for an intentional internal call. Cloud-metadata IPs are
   * always blocked regardless of this flag.
   */
  allowPrivateHosts?: boolean;
}

/** Default policy — use for most external GET/read calls */
export const DEFAULT_POLICY: Partial<DependencyPolicy> = {
  timeoutMs: 10_000,
  maxRetries: 2,
  backoffMs: 400,
};

/** Use for AI/LLM calls — longer timeout, fewer retries */
export const AI_CALL_POLICY: Partial<DependencyPolicy> = {
  timeoutMs: 30_000,
  maxRetries: 1,
  backoffMs: 1_000,
};

/** Use for non-idempotent writes — no retries to avoid duplicate mutations */
export const WRITE_POLICY: Partial<DependencyPolicy> = {
  timeoutMs: 10_000,
  maxRetries: 0,
};

/** Use for health checks / fast probes */
export const HEALTH_CHECK_POLICY: Partial<DependencyPolicy> = {
  timeoutMs: 5_000,
  maxRetries: 0,
};

/**
 * Wraps fetch with timeout, retry, structured logging, and request ID propagation.
 * Throws a GuardrailError (UPSTREAM_FAILURE or UPSTREAM_TIMEOUT) on any failure.
 */
export async function fetchWithGuardrails(
  url: string | URL,
  options: FetchWithGuardrailsOptions,
): Promise<Response> {
  const {
    requestId,
    where,
    dependency = inferDependency(url),
    timeoutMs,
    retries,
    backoffMs,
    allowPrivateHosts,
    headers: rawHeaders,
    ...restInit
  } = options;

  // SSRF egress gate — refuse internal/metadata IP hosts before any network I/O.
  // Fail loudly (never silently swallow); redact the URL so a token in it never
  // leaks into the error/log.
  const egress = checkUrlEgress(url, { allowPrivateHosts });
  if (!egress.allowed) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where,
      message: `Blocked SSRF-risk request to ${egress.reason} host (${egress.host})`,
      details: {
        dependency,
        blocked_host: egress.host,
        reason: egress.reason,
        url: redactSensitiveUrl(String(url)),
      },
      status: 502,
    });
  }

  // Propagate request ID to the upstream service
  const headers = new Headers(rawHeaders as HeadersInit | undefined);
  headers.set("x-request-id", requestId);
  if (!headers.has("content-type") && restInit.body) {
    headers.set("content-type", "application/json");
  }

  const policy: Partial<DependencyPolicy> = {};
  if (typeof timeoutMs !== "undefined") policy.timeoutMs = timeoutMs;
  if (typeof retries !== "undefined") policy.maxRetries = retries;
  if (typeof backoffMs !== "undefined") policy.backoffMs = backoffMs;

  return fetchWithPolicy(
    requestId,
    where,
    dependency,
    url,
    { ...restInit, headers },
    policy,
  );
}

function inferDependency(url: string | URL): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("onrender.com")) return "render-backend";
    if (hostname.includes("openai.com")) return "openai";
    if (hostname.includes("supabase.co")) return "supabase";
    if (hostname.includes("resend.com")) return "resend";
    return hostname;
  } catch {
    return "external";
  }
}
