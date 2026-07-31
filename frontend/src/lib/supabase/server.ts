import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import type { Database } from "@/types/database.types";
import type { User } from "@supabase/supabase-js";
import { getBestSupabaseAuthToken } from "./auth-cookie";

/**
 * If using Fluid compute: Don't put this client in a global variable. Always create a new client within each
 * function when using it.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // Only set cookies that have actual values. When Supabase Auth
          // is rate-limited, the SSR client calls setAll with empty values
          // to clear auth cookies. Allowing this would log users out and
          // break subsequent requests. The middleware handles token refresh.
          cookiesToSet
            .filter(({ value }) => value !== "")
            .forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
        } catch (error) {
          console.warn(JSON.stringify({
            event: "supabase_server_cookie_set_suppressed",
            timestamp: new Date().toISOString(),
            reason:
              "The Supabase SSR client attempted to mutate cookies from a server component request context.",
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      },
    },
  });
}

/**
 * Get the authenticated user from the Supabase cookie JWT without an Auth
 * network call. Returns a minimal User-like object or null.
 */
export async function getApiRouteUser(): Promise<Pick<User, "id" | "email"> | null> {
  // Read the user directly from the cookie JWT first — zero network calls.
  // This avoids Supabase Auth rate limiting entirely for API routes.
  // The user identity is sufficient since data operations use the service role client.
  const cookieUser = await getUserFromCookieJwt();
  if (cookieUser) {
    return cookieUser;
  }

  return null;
}

export async function getApiRouteUserFromRequest(
  request: Pick<Request, "headers">,
): Promise<Pick<User, "id" | "email"> | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7).trim();
      if (!token) return null;
      const supabase = createClientWithToken(token);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (!user) return null;
      return { id: user.id, email: user.email ?? "" };
    } catch (error) {
      console.warn(JSON.stringify({
        event: "supabase_bearer_auth_failed",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }));
      return null;
    }
  }

  return getApiRouteUser();
}

async function getUserFromCookieJwt(): Promise<Pick<User, "id" | "email"> | null> {
  try {
    const cookieStore = await cookies();
    const tokenData = getBestSupabaseAuthToken(cookieStore.getAll());
    if (!tokenData?.userId) return null;
    if (
      typeof tokenData.expiresAtMs === "number" &&
      tokenData.expiresAtMs <= Date.now() + 15_000
    ) {
      return null;
    }

    return { id: tokenData.userId, email: tokenData.email };
  } catch (error) {
    console.warn(JSON.stringify({
      event: "supabase_cookie_auth_failed",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}

/**
 * Create a Supabase client with a specific access token.
 * Use this when handling API requests with Bearer tokens (e.g., from Playwright tests).
 * This client will have the user's RLS permissions based on the token.
 */
export function createClientWithToken(accessToken: string) {
  const { url, anonKey } = getSupabaseConfig();

  return createSupabaseClient<Database>(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
