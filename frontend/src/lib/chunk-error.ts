import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";

/**
 * Shared helpers for recovering from "Loading chunk failed" errors.
 *
 * These happen when a new deployment invalidates the hashed static chunks that
 * an already-open tab still references: the old chunk URL 404s and the dynamic
 * import throws. The remedy is a single full-page reload, which re-fetches the
 * current HTML and its new chunk hashes.
 *
 * Both the top-level {@link ChunkLoadErrorRecovery} boundary and the per-route
 * error boundary ({@link RouteErrorPage}) use these helpers and, crucially,
 * share {@link RELOAD_KEY} so a reload triggered by one is respected by the
 * other — that shared cooldown is what prevents an infinite reload loop.
 */

const RELOAD_KEY = "chunk-error-reload";
const RELOAD_COOLDOWN_MS = 10_000; // Don't auto-reload more than once per 10s

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("loading chunk") ||
    msg.includes("failed to load chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    // Next.js specific chunk patterns
    msg.includes("loading css chunk") ||
    msg.includes("_next/static")
  );
}

export function shouldAutoReload(): boolean {
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    if (!last) return true;
    return Date.now() - Number(last) > RELOAD_COOLDOWN_MS;
  } catch {
    // sessionStorage blocked (incognito, etc.) — allow one reload
    return true;
  }
}

export function markReload(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch (error) {
    reportNonCriticalFailure({
      area: "chunk-error-recovery",
      operation: "mark-reload",
      error,
      userVisibleFallback: "Chunk reload marker could not be saved.",
    });
  }
}
