type CookieLike = {
  name: string;
  value: string;
};

type SessionTokenData = {
  userId: string;
  email: string;
  expiresAtMs: number | null;
  isDeveloper: boolean;
  isAdmin: boolean;
};

const AUTH_COOKIE_PATTERN = /^sb-[^-]+-auth-token(?:\.\d+)?$/;

function getBaseCookieName(cookieName: string): string {
  return cookieName.replace(/\.\d+$/, "");
}

function decodeSessionValue(rawValue: string): string {
  let value = rawValue;
  try {
    value = decodeURIComponent(rawValue);
  } catch (error) {
    console.warn(JSON.stringify({
      event: "supabase_auth_cookie_decode_uri_failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }));
    value = rawValue;
  }

  if (!value.startsWith("base64-")) {
    return value;
  }

  const b64url = value.slice(7).replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (b64url.length % 4)) % 4);
  return Buffer.from(b64url + padding, "base64").toString("utf-8");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (payloadB64.length % 4)) % 4);

  return JSON.parse(Buffer.from(payloadB64 + padding, "base64").toString());
}

function extractCombinedSessionValue(
  cookies: CookieLike[],
  baseName: string,
): string | null {
  // Match Supabase's cookie chunking behavior: if the base key exists, use it
  // directly; otherwise reconstruct from contiguous .0, .1, .2 chunks.
  const exact = cookies.find((c) => c.name === baseName);
  if (exact?.value) {
    return exact.value;
  }

  const chunks = cookies
    .filter((c) => c.name.startsWith(`${baseName}.`))
    .map((cookie) => {
      const match = cookie.name.match(/\.(\d+)$/);
      return {
        index: match ? Number(match[1]) : Number.NaN,
        value: cookie.value,
      };
    })
    .filter((chunk) => Number.isInteger(chunk.index))
    .sort((a, b) => a.index - b.index);

  if (chunks.length === 0) {
    return null;
  }

  const contiguousValues: string[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (chunks[i].index !== i || !chunks[i].value) {
      break;
    }
    contiguousValues.push(chunks[i].value);
  }

  return contiguousValues.length > 0 ? contiguousValues.join("") : null;
}

function parseCookieValueToTokenData(rawValue: string): SessionTokenData | null {
  const sessionJson = decodeSessionValue(rawValue);
  const sessionData = JSON.parse(sessionJson);
  if (!sessionData?.access_token || typeof sessionData.access_token !== "string") {
    return null;
  }

  const payload = decodeJwtPayload(sessionData.access_token);
  if (!payload || typeof payload.sub !== "string") {
    return null;
  }

  const appMetadata =
    payload.app_metadata && typeof payload.app_metadata === "object"
      ? (payload.app_metadata as Record<string, unknown>)
      : null;

  return {
    userId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    expiresAtMs:
      typeof payload.exp === "number" && Number.isFinite(payload.exp)
        ? payload.exp * 1000
        : null,
    isDeveloper: payload.is_developer === true,
    // Authorization is only derived from the signed access-token claim or
    // app_metadata. Never read user_metadata here: users can edit it.
    isAdmin: payload.is_admin === true || appMetadata?.is_admin === true,
  };
}

/**
 * Parse Supabase auth cookies and return the most recent valid token payload.
 * This avoids stale cookie corruption by evaluating each auth cookie key
 * independently instead of concatenating all matching cookies together.
 */
export function getBestSupabaseAuthToken(
  cookies: CookieLike[],
): SessionTokenData | null {
  const authCookies = cookies.filter((cookie) =>
    AUTH_COOKIE_PATTERN.test(cookie.name),
  );
  if (authCookies.length === 0) {
    return null;
  }

  const baseNames = [
    ...new Set(authCookies.map((cookie) => getBaseCookieName(cookie.name))),
  ];
  const parsed: SessionTokenData[] = [];

  for (const baseName of baseNames) {
    const combined = extractCombinedSessionValue(authCookies, baseName);
    if (!combined) {
      continue;
    }

    try {
      const tokenData = parseCookieValueToTokenData(combined);
      if (tokenData) {
        parsed.push(tokenData);
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: "supabase_auth_cookie_parse_failed",
        timestamp: new Date().toISOString(),
        baseName,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  if (parsed.length === 0) {
    return null;
  }

  return parsed.sort((a, b) => (b.expiresAtMs ?? 0) - (a.expiresAtMs ?? 0))[0];
}
