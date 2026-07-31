/**
 * Shared error formatting utilities.
 *
 * These helpers turn opaque "Failed to X" messages into user-friendly
 * descriptions that include *what went wrong* so users (and developers
 * reading logs) can actually diagnose the problem.
 */

/**
 * Extract a human-readable detail string from an unknown error value.
 *
 * Handles Error objects, fetch Response-shaped objects, Supabase error
 * objects ({ message, code, details }), plain strings, and falls back
 * to a generic hint rather than the useless "Unknown error".
 */
export function getErrorDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    // Supabase errors: { message, code, details, hint }
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error === "string" && obj.error) return obj.error;
    if (typeof obj.detail === "string" && obj.detail) return obj.detail;
    if (typeof obj.details === "string" && obj.details) return obj.details;
  }
  return "An unexpected error occurred — please try again or contact support";
}

/**
 * Build a contextual error message for display in toasts / UI.
 *
 * @param action  What the user was trying to do, e.g. "save the commitment"
 * @param err     The caught error value
 * @returns       e.g. "Could not save the commitment: duplicate key on cost_code"
 */
export function formatUserError(action: string, err: unknown): string {
  const detail = getErrorDetail(err);
  return `Could not ${action}: ${detail}`;
}

/**
 * Build an Error instance with a contextual message.
 * Use in catch blocks where you need to re-throw or set error state.
 */
export function toContextualError(action: string, err: unknown): Error {
  if (err instanceof Error) {
    // Preserve the original stack but improve the message
    err.message = `Could not ${action}: ${err.message}`;
    return err;
  }
  return new Error(formatUserError(action, err));
}

/**
 * Extract error detail from a failed fetch Response.
 * Tries to parse JSON body for { error, message, detail } fields,
 * falls back to the HTTP status text.
 */
export async function extractFetchError(
  response: Response,
  action: string,
): Promise<Error> {
  let detail: string;
  try {
    const body = await response.json();
    detail =
      body.error ||
      body.message ||
      body.detail ||
      `server returned ${response.status} ${response.statusText}`;
  } catch {
    detail = `server returned ${response.status} ${response.statusText}`;
  }
  return new Error(`Could not ${action}: ${detail}`);
}
