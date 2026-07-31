import { GuardrailError } from "@/lib/guardrails/errors";
import { logEvent } from "@/lib/guardrails/observability";

export interface DependencyPolicy {
  timeoutMs: number;
  maxRetries: number;
  backoffMs: number;
  retryableStatuses: number[];
}

export const DEFAULT_DEPENDENCY_POLICY: DependencyPolicy = {
  timeoutMs: 10_000,
  maxRetries: 2,
  backoffMs: 400,
  retryableStatuses: [408, 425, 429, 500, 502, 503, 504],
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|network|fetch/i.test(message);
}

export async function fetchWithPolicy(
  requestId: string,
  where: string,
  dependency: string,
  input: RequestInfo | URL,
  init?: RequestInit,
  policy: Partial<DependencyPolicy> = {},
): Promise<Response> {
  const config: DependencyPolicy = {
    ...DEFAULT_DEPENDENCY_POLICY,
    ...policy,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const attemptStarted = Date.now();

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const durationMs = Date.now() - attemptStarted;
      const shouldRetry = config.retryableStatuses.includes(response.status);
      if (!response.ok && shouldRetry && attempt < config.maxRetries) {
        logEvent({
          event: "dependency_retry",
          level: "warn",
          requestId,
          where,
          dependency,
          durationMs,
          details: {
            attempt: attempt + 1,
            status: response.status,
          },
        });
        await sleep(config.backoffMs * (attempt + 1));
        continue;
      }

      if (!response.ok) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where,
          message: `${dependency} returned HTTP ${response.status}`,
          details: {
            dependency,
            status: response.status,
          },
          status: 502,
        });
      }

      logEvent({
        event: "dependency_success",
        requestId,
        where,
        dependency,
        durationMs,
        details: {
          attempt: attempt + 1,
          status: response.status,
        },
      });

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      const retryable = isRetryableError(error);
      if (!retryable || attempt >= config.maxRetries) {
        break;
      }

      logEvent({
        event: "dependency_retry",
        level: "warn",
        requestId,
        where,
        dependency,
        details: {
          attempt: attempt + 1,
          reason: error instanceof Error ? error.message : String(error),
        },
      });
      await sleep(config.backoffMs * (attempt + 1));
    }
  }

  throw new GuardrailError({
    code: "UPSTREAM_TIMEOUT",
    where,
    message: `${dependency} did not complete within retry policy.`,
    details: {
      dependency,
      retries: config.maxRetries,
      timeout_ms: config.timeoutMs,
      reason: lastError instanceof Error ? lastError.message : String(lastError),
    },
    status: 504,
  });
}

