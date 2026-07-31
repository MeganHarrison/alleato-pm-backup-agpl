import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Sign in required.", status: 401 });
  }
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    throw new GuardrailError({ code: "FORBIDDEN", where, message: "Admin access required.", status: 403 });
  }
}

export const POST = withApiGuardrails("api.admin.cron.progress-reports.POST", async ({ request }) => {
  await requireAdmin("api.admin.cron.progress-reports.POST");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    throw new GuardrailError({
      code: "MISSING_ENV_VAR",
      where: "api.admin.cron.progress-reports.POST",
      message: "CRON_SECRET is not configured.",
      status: 503,
    });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");

  const res = await fetch(`${baseUrl}/api/cron/progress-reports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cronSecret}` },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new GuardrailError({
      code: "UPSTREAM_ERROR",
      where: "api.admin.cron.progress-reports.POST",
      message: (body as { error?: string }).error ?? "Progress reports cron failed.",
      status: res.status,
    });
  }

  return NextResponse.json({ ok: true, ...(body as object) });
});
