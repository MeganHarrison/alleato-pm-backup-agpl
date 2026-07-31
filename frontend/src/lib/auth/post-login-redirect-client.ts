/**
 * Resolves the post-login landing path, retrying once if the server falls
 * back to "/" despite a valid deep-link callback (e.g. a scanned drawing QR
 * code). The fallback is ambiguous: it means either "you can't access that
 * page" or "the session cookie from signInWithPassword hadn't reached the
 * server yet" (a race right after sign-in resolves on the client). Retrying
 * once rules out the race without weakening the access-denied protection —
 * a user who genuinely lacks access still gets "/" on the second try.
 */
// A first request in local development may compile the route on demand. Keep
// login bounded, but never use the short form-submission timeout that aborts a
// valid authenticated redirect before that compile completes.
export const POST_LOGIN_REDIRECT_TIMEOUT_MS = 30_000;

/**
 * A client must never bypass the server's authorization-aware destination
 * decision when that resolution fails. Home remains the safe recovery route.
 */
export function getSafePostLoginFallback(): "/" {
  return "/";
}

export async function resolvePostLoginRedirect(
  fetchRedirect: () => Promise<{ redirect?: string } | null | undefined>,
  validatedCallback: string | null,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<string> {
  const first = await fetchRedirect();
  if (first?.redirect && first.redirect !== "/") {
    return first.redirect;
  }
  if (!validatedCallback) {
    return first?.redirect || getSafePostLoginFallback();
  }

  await wait(300);
  const retry = await fetchRedirect().catch(() => null);
  return retry?.redirect || getSafePostLoginFallback();
}
