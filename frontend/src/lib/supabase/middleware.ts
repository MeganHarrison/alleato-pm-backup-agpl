import { type NextRequest, NextResponse } from "next/server";

import { isAdminDashboardEmailAllowed } from "@/lib/auth/admin-dashboard-allowlist";
import { usesAppAdminApiAccess } from "@/lib/auth/admin-page-access";
import { getBestSupabaseAuthToken } from "./auth-cookie";
import { validateCallbackUrl } from "@/lib/validation/callback-url";

// Company-wide paths that require developer role.
// NOTE: "/ai-assistant" is intentionally NOT here — the AI assistant is
// available to all authenticated users. Re-adding it must be paired with
// re-adding `developerOnly: true` in navigation-config.ts (see guardrail tests).
const DEVELOPER_ONLY_COMPANY_PREFIXES = [
  "/executive",
  "/financial-insights",
  "/pipeline",
  "/team-chat",
  "/knowledge",
  "/stats",
  "/ai-avatar",
  "/calendar",
  "/billing-periods",
  "/ai-chat-history",
];

// Project-scoped route segments (after /[projectId]/) that require developer role.
// Core Procore tools (meetings, tasks, emails, schedule, rfis, etc.) are NOT listed here.
const DEVELOPER_ONLY_PROJECT_SEGMENTS = new Set([
  "intelligence",
  "hub",
  "billing-periods",
  "client-dashboard",
  "email-attachments",
  "timeline",
  "progress-reports",
  "project-status-report",
]);

const LEGACY_LOGIN_PATHS = new Set([
  "/auth/login-v2",
  "/auth/login-v3",
]);

function isDevOnlyPath(pathname: string): boolean {
  for (const prefix of DEVELOPER_ONLY_COMPANY_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return true;
  }
  // Match /123/segment paths
  const match = pathname.match(/^\/\d+\/([^/]+)/);
  if (match) return DEVELOPER_ONLY_PROJECT_SEGMENTS.has(match[1]);
  return false;
}

function isAdminApiPath(pathname: string): boolean {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

// Not every route under /api/admin is actually admin-only. The Velt bridge
// writes the authenticated commenter's page feedback into the shared Alleato
// inbox, so blocking it at middleware turns a successful page comment into a
// loud mirror failure for every non-allowlisted teammate.
function isAuthenticatedAdminApiException(pathname: string): boolean {
  return pathname === "/api/admin/feedback/velt";
}

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-alleato-pathname", request.nextUrl.pathname);
  const supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });
  const pathname = request.nextUrl.pathname;

  if (LEGACY_LOGIN_PATHS.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  if (isAdminApiPath(pathname) && !isAuthenticatedAdminApiException(pathname)) {
    const tokenData = getBestSupabaseAuthToken(request.cookies.getAll());
    if (
      !tokenData?.userId ||
      (typeof tokenData.expiresAtMs === "number" &&
        tokenData.expiresAtMs <= Date.now() + 15_000)
    ) {
      return NextResponse.json(
        { error: "Sign in before accessing admin controls." },
        { status: 401 },
      );
    }

    if (usesAppAdminApiAccess(pathname) && !tokenData.isAdmin) {
      return NextResponse.json(
        { error: "App admin access is required for this configuration API." },
        { status: 403 },
      );
    }

    if (
      !usesAppAdminApiAccess(pathname) &&
      !isAdminDashboardEmailAllowed(tokenData.email)
    ) {
      return NextResponse.json(
        {
          error:
            "Admin dashboard access is restricted to Megan Harrison and Brandon Clymer.",
        },
        { status: 403 },
      );
    }

    return supabaseResponse;
  }

  if (shouldBypassSessionMiddleware(pathname)) {
    return supabaseResponse;
  }

  const tokenData = getBestSupabaseAuthToken(request.cookies.getAll());
  if (
    !tokenData?.userId ||
    (typeof tokenData.expiresAtMs === "number" &&
      tokenData.expiresAtMs <= Date.now() + 15_000)
  ) {
    return redirectToLogin(request);
  }

  if (isDevOnlyPath(pathname) && !tokenData.isDeveloper) {
    const url = request.nextUrl.clone();
    url.pathname = "/access-denied";
    url.search = "?reason=developer-only";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export function shouldBypassSessionMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/webviewer/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/respond/") ||
    // Static/public assets never carry app auth. Keep this list in sync with the
    // matcher in `@/middleware`. xlsx/xls/csv cover downloadable public templates
    // (e.g. /alleato-budget-template.xlsx) — without them the request is redirected
    // to /auth/login and an `<a download>` click silently downloads nothing.
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|mjs|map|txt|xml|xlsx|xls|csv)$/i.test(pathname)
  );
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  url.search = "";
  const rawCallback = request.nextUrl.pathname + request.nextUrl.search;
  url.searchParams.set("callbackUrl", validateCallbackUrl(rawCallback));
  return NextResponse.redirect(url);
}
