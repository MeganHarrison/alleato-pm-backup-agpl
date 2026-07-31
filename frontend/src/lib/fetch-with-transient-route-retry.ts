const TRANSIENT_ROUTE_PATTERNS = [
  "Cannot find module for page",
  "PageNotFoundError",
  "Could not find files for /_error",
] as const;

const isReadMethod = (method?: string) => {
  if (!method) return true;
  const normalized = method.toUpperCase();
  return normalized === "GET" || normalized === "HEAD";
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const shouldRetryTransientRouteError = async (
  response: Response,
  method?: string,
) => {
  if (response.ok) return false;
  if (!isReadMethod(method)) return false;
  if (response.status !== 500) return false;

  const body = await response
    .clone()
    .text()
    .catch(() => "");

  return TRANSIENT_ROUTE_PATTERNS.some((pattern) =>
    body.includes(pattern),
  );
};

/**
 * Retries transient Next.js route-module misses observed during dev compilation.
 * Only retries idempotent GET/HEAD requests and only for known module-miss signatures.
 */
export async function fetchWithTransientRouteRetry(
  input: string,
  init?: RequestInit,
  options?: { retries?: number; delayMs?: number },
) {
  const retries = options?.retries ?? 2;
  const delayMs = options?.delayMs ?? 200;
  const method = init?.method;

  let attempt = 0;
  while (true) {
    const response = await fetch(input, init);
    const shouldRetry = await shouldRetryTransientRouteError(response, method);

    if (!shouldRetry || attempt >= retries) {
      return response;
    }

    attempt += 1;
    await wait(delayMs * attempt);
  }
}

