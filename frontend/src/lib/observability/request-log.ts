import type { NextRequest, NextResponse } from "next/server";
import { getBestSupabaseAuthToken } from "@/lib/supabase/auth-cookie";

let missingRequestLogEnvReported = false;

function getRequestId(request: NextRequest): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

function firstForwardedIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function truncate(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function recordRequestLog(
  request: NextRequest,
  response: NextResponse,
  startedAt: number,
): Promise<void> {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    if (!missingRequestLogEnvReported) {
      missingRequestLogEnvReported = true;
      console.error(
        "[request-log] Missing Supabase service-role configuration; app_request_log writes are disabled.",
      );
    }
    return;
  }

  const tokenData = getBestSupabaseAuthToken(request.cookies.getAll());
  const clientIp = firstForwardedIp(request);
  const metadata: Record<string, unknown> = {
    host: request.headers.get("host"),
    deployment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };

  const payload = {
    request_id: getRequestId(request),
    method: request.method,
    path: request.nextUrl.pathname,
    query_string: truncate(request.nextUrl.search.replace(/^\?/, ""), 2048),
    status_code: response.status,
    duration_ms: Math.max(0, Date.now() - startedAt),
    user_id: tokenData?.userId ?? null,
    user_email: tokenData?.email ?? null,
    client_ip_hash: clientIp ? await sha256Hex(clientIp) : null,
    user_agent: truncate(request.headers.get("user-agent"), 512),
    referrer: truncate(request.headers.get("referer"), 1024),
    source: "middleware",
    metadata,
  };

  const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/app_request_log`;
  const result = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    const details = await result.text().catch(() => "");
    console.error(
      `[request-log] app_request_log insert failed: ${result.status} ${details}`,
    );
  }
}
