import { GuardrailError } from "@/lib/guardrails/errors";
import type { DependencyPolicy } from "@/lib/guardrails/dependency";
import { fetchWithPolicy } from "@/lib/guardrails/dependency";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

type SourceSyncPath = "status" | "recompute" | "graph-sync" | "graph-embed";

export function getBackendSourceSyncUrl(
  path: SourceSyncPath,
  searchParams?: Record<string, string | number | boolean | null | undefined>,
): string {
  const backendUrl = (
    process.env.SOURCE_SYNC_BACKEND_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://127.0.0.1:8000"
      : process.env.BACKEND_URL || process.env.PYTHON_BACKEND_URL) ||
    ""
  )
    .replace(/\/+$/, "")
    .trim();

  try {
    new URL(backendUrl);
  } catch {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "api.admin.source-sync.backend-url",
      message: "Missing or invalid backend URL. Set BACKEND_URL or PYTHON_BACKEND_URL.",
      details: {
        BACKEND_URL: process.env.BACKEND_URL,
        PYTHON_BACKEND_URL: process.env.PYTHON_BACKEND_URL,
      },
      status: 503,
    });
  }

  let url: string;
  if (path === "graph-sync") {
    url = `${backendUrl}/api/graph/sync`;
  } else if (path === "graph-embed") {
    url = `${backendUrl}/api/graph/embed`;
  } else {
    const suffix = path === "recompute" ? "/recompute" : "";
    url = `${backendUrl}/api/health/source-sync${suffix}`;
  }

  if (searchParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    if (query) return `${url}?${query}`;
  }
  return url;
}

export function getBackendAdminApiKey(): string {
  const apiKey = process.env.ADMIN_API_KEY?.trim();
  if (!apiKey) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "api.admin.source-sync.admin-key",
      message: "ADMIN_API_KEY is required to call backend source sync controls.",
      status: 503,
    });
  }
  return apiKey;
}

export async function requireAdmin(where: string): Promise<{ userId: string }> {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  const userError = null as Error | null;

  if (userError || !user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before using source sync controls.",
      status: 401,
      details: userError?.message,
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.is_admin) {
    throw new GuardrailError({
      code: "FORBIDDEN",
      where,
      message: "Admin access is required to use source sync controls.",
      status: 403,
      details: profileError?.message,
    });
  }

  return { userId: user.id };
}

export async function fetchBackendSourceSync(
  requestId: string,
  where: string,
  path: SourceSyncPath,
  init?: RequestInit,
  searchParams?: Record<string, string | number | boolean | null | undefined>,
  policy?: Partial<DependencyPolicy>,
): Promise<Response> {
  const apiKey = getBackendAdminApiKey();
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Admin-Api-Key", apiKey);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetchWithPolicy(
    requestId,
    where,
    `backend.source-sync.${path}`,
    getBackendSourceSyncUrl(path, searchParams),
    {
      ...init,
      headers,
      cache: "no-store",
    },
    {
      timeoutMs:
        path === "graph-sync"
          ? 270_000
          : path === "recompute" || path === "graph-embed"
            ? 60_000
            // "status" path: the backend serves from a stale-while-revalidate
            // cache (~0.2 s warm), so this only matters on a cold-process miss.
            // 45 s gives the rare synchronous 16-22 s recompute headroom instead
            // of dropping the panel to "unavailable" at the old 25 s boundary.
            : 45_000,
      maxRetries: path === "recompute" || path === "graph-sync" ? 0 : 1,
      backoffMs: 250,
      ...policy,
    },
  );
}
