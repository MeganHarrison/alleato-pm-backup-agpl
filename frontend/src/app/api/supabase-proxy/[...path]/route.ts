import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

/** Resolve route params whether Next provides plain object or promise-wrapped params. */
async function resolvePathParams(
  rawParams: { path: string[] } | Promise<{ path: string[] }>,
): Promise<{ path: string[] }> {
  return rawParams instanceof Promise ? await rawParams : rawParams;
}

/** Proxy a request to the Supabase Management API with enforced auth and admin checks. */
async function forwardToSupabaseAPI(
  request: Request,
  method: string,
  params: { path: string[] } | Promise<{ path: string[] }>,
) {
  if (!process.env.SUPABASE_MANAGEMENT_API_TOKEN) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "/api/supabase-proxy/[...path]#forward",
      message: "SUPABASE_MANAGEMENT_API_TOKEN is not configured.",
      details: { variable: "SUPABASE_MANAGEMENT_API_TOKEN" },
      severity: "high",
    });
  }

  // Authenticate the request and verify admin role.
  // OWASP A01:2021 - Broken Access Control: Supabase Management API
  // access is restricted to verified admin users only.
  const supabase = await createClient();
  const user = await getApiRouteUser();
  const authError = null as Error | null;
  if (authError || !user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "/api/supabase-proxy/[...path]#forward",
      message: "Unauthorized Supabase proxy request.",
      status: 401,
      severity: "medium",
      details: authError ? { reason: authError.message } : undefined,
      cause: authError ?? undefined,
    });
  }

  // Verify the user has admin privileges before proxying to the Management API
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where: "/api/supabase-proxy/[...path]#forward",
      message: "Admin access required to use the Supabase Management API proxy.",
      status: 403,
      severity: "medium",
    });
  }

  const resolvedParams = await resolvePathParams(params);
  const apiPath = resolvedParams.path.join("/");
  if (!apiPath) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/supabase-proxy/[...path]#forward",
      message: "Proxy path is required.",
      status: 400,
      severity: "low",
    });
  }

  const url = new URL(request.url);
  url.protocol = "https";
  url.hostname = "api.supabase.com";
  url.port = "443";
  url.pathname = apiPath;

  try {
    const forwardHeaders: HeadersInit = {
      Authorization: `Bearer ${process.env.SUPABASE_MANAGEMENT_API_TOKEN}`,
    };

    // Copy relevant headers from the original request
    const contentType = request.headers.get("content-type");
    if (contentType) {
      forwardHeaders["Content-Type"] = contentType;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: forwardHeaders,
    };

    // Include body for methods that support it
    if (method !== "GET" && method !== "HEAD") {
      try {
        const body = await request.text();
        if (body) {
          fetchOptions.body = body;
        }
      } catch (error) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where: "/api/supabase-proxy/[...path]#forward",
          message: "Failed to read proxy request body.",
          status: 400,
          severity: "low",
          details: { reason: error instanceof Error ? error.message : "Unknown error" },
          cause: error instanceof Error ? error : undefined,
        });
      }
    }

    const response = await fetch(url, fetchOptions);

    // Get response body
    const responseText = await response.text();
    let responseData;

    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText;
    }

    // Return the response with the same status
    return NextResponse.json(responseData, { status: response.status });
  } catch (error: unknown) {
    if (error instanceof GuardrailError) throw error;
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "/api/supabase-proxy/[...path]#forward",
      message: "Supabase Management API proxy request failed.",
      status: 502,
      severity: "high",
      details: { reason: error instanceof Error ? error.message : "Unknown error" },
      cause: error instanceof Error ? error : undefined,
    });
  }
}

export const GET = withApiGuardrails<{ path: string[] }>(
  "/api/supabase-proxy/[...path]#GET",
  async ({ request, params }) => forwardToSupabaseAPI(request, "GET", params),
);

export const HEAD = withApiGuardrails<{ path: string[] }>(
  "/api/supabase-proxy/[...path]#HEAD",
  async ({ request, params }) => forwardToSupabaseAPI(request, "HEAD", params),
);

export const POST = withApiGuardrails<{ path: string[] }>(
  "/api/supabase-proxy/[...path]#POST",
  async ({ request, params }) => forwardToSupabaseAPI(request, "POST", params),
);

export const PUT = withApiGuardrails<{ path: string[] }>(
  "/api/supabase-proxy/[...path]#PUT",
  async ({ request, params }) => forwardToSupabaseAPI(request, "PUT", params),
);

export const DELETE = withApiGuardrails<{ path: string[] }>(
  "/api/supabase-proxy/[...path]#DELETE",
  async ({ request, params }) => forwardToSupabaseAPI(request, "DELETE", params),
);

export const PATCH = withApiGuardrails<{ path: string[] }>(
  "/api/supabase-proxy/[...path]#PATCH",
  async ({ request, params }) => forwardToSupabaseAPI(request, "PATCH", params),
);
