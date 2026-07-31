import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "./client";
import type { Database } from "@/types/database.types";

const CACHE_TTL_MS = 2_000;
const AUTH_STORAGE_PATTERN = /^sb-[^-]+-auth-token$/;
const AUTH_COOKIE_PATTERN = /^sb-[^-]+-auth-token(?:\.\d+)?$/;

let inFlightUserRequest: Promise<User | null> | null = null;
let cachedUser:
  | {
      user: User | null;
      expiresAt: number;
    }
  | null = null;

type StoredSupabaseSession = {
  access_token?: unknown;
  expires_at?: unknown;
  expires_in?: unknown;
  user?: unknown;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseStoredSession(rawValue: string): { user: User | null; expiresAt: number } | null {
  try {
    let sessionValue = decodeURIComponent(rawValue);
    if (sessionValue.startsWith("base64-")) {
      const payload = sessionValue.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      sessionValue = globalThis.atob(payload + "=".repeat((4 - (payload.length % 4)) % 4));
    }

    const session = JSON.parse(sessionValue) as StoredSupabaseSession;
    const expiresAt =
      typeof session.expires_at === "number"
        ? session.expires_at * 1000
        : typeof session.expires_in === "number"
          ? Date.now() + session.expires_in * 1000
          : null;

    if (expiresAt && expiresAt <= Date.now() + 15_000) {
      return null;
    }

    if (session.user && typeof session.user === "object") {
      return {
        user: session.user as User,
        expiresAt: expiresAt ?? Date.now() + CACHE_TTL_MS,
      };
    }

    if (typeof session.access_token !== "string") {
      return null;
    }

    const payload = decodeJwtPayload(session.access_token);
    if (!payload || typeof payload.sub !== "string") {
      return null;
    }

    return {
      user: {
        id: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
      } as User,
      expiresAt: expiresAt ?? Date.now() + CACHE_TTL_MS,
    };
  } catch {
    return null;
  }
}

function getBaseCookieName(cookieName: string): string {
  return cookieName.replace(/\.\d+$/, "");
}

function getCurrentUserFromBrowserCookies(): User | null {
  if (typeof document === "undefined") {
    return null;
  }

  try {
    const cookies = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separatorIndex = cookie.indexOf("=");
        return {
          name: separatorIndex >= 0 ? cookie.slice(0, separatorIndex) : cookie,
          value: separatorIndex >= 0 ? cookie.slice(separatorIndex + 1) : "",
        };
      })
      .filter((cookie) => AUTH_COOKIE_PATTERN.test(cookie.name));

    const baseNames = Array.from(new Set(cookies.map((cookie) => getBaseCookieName(cookie.name))));
    const candidates: Array<{ user: User | null; expiresAt: number }> = [];

    for (const baseName of baseNames) {
      const exact = cookies.find((cookie) => cookie.name === baseName);
      const rawValue = exact?.value ?? cookies
        .filter((cookie) => cookie.name.startsWith(`${baseName}.`))
        .map((cookie) => {
          const match = cookie.name.match(/\.(\d+)$/);
          return {
            index: match ? Number(match[1]) : Number.NaN,
            value: cookie.value,
          };
        })
        .filter((chunk) => Number.isInteger(chunk.index))
        .sort((left, right) => left.index - right.index)
        .map((chunk, expectedIndex) => (chunk.index === expectedIndex ? chunk.value : ""))
        .join("");

      if (!rawValue) {
        continue;
      }

      const parsed = parseStoredSession(rawValue);
      if (parsed) {
        candidates.push(parsed);
      }
    }

    const best = candidates.sort((left, right) => right.expiresAt - left.expiresAt)[0];
    return best?.user ?? null;
  } catch {
    return null;
  }
}

function getCurrentUserFromBrowserStorage(): User | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidates: Array<{ user: User | null; expiresAt: number }> = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !AUTH_STORAGE_PATTERN.test(key)) {
        continue;
      }

      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        continue;
      }

      const parsed = parseStoredSession(rawValue);
      if (parsed) {
        candidates.push(parsed);
      }
    }
  } catch {
    return null;
  }

  const best = candidates.sort((left, right) => right.expiresAt - left.expiresAt)[0];
  return best?.user ?? null;
}

/**
 * Coalesces browser-side Supabase user lookups so route shell components do
 * not race each other through Supabase's Web Locks auth storage.
 */
export async function getCurrentBrowserUser(
  supabase: SupabaseClient<Database> = createClient(),
): Promise<User | null> {
  const storedUser = getCurrentUserFromBrowserStorage() ?? getCurrentUserFromBrowserCookies();
  if (storedUser) {
    cachedUser = {
      user: storedUser,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return storedUser;
  }

  if (cachedUser && cachedUser.expiresAt > Date.now()) {
    return cachedUser.user;
  }

  if (inFlightUserRequest) {
    return inFlightUserRequest;
  }

  inFlightUserRequest = supabase.auth
    .getUser()
    .then(({ data, error }) => {
      if (error) {
        throw error;
      }

      const user = data.user ?? null;
      cachedUser = {
        user,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      return user;
    })
    .finally(() => {
      inFlightUserRequest = null;
    });

  return inFlightUserRequest;
}

export function resetCurrentBrowserUserCache(): void {
  cachedUser = null;
  inFlightUserRequest = null;
}
