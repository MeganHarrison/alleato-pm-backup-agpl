import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const GET = withApiGuardrails("/api/admin/feedback/github-comments#GET", async ({ request }) => {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({ code: "AUTH_EXPIRED", where: "/api/admin/feedback/github-comments#GET", message: "Authentication required.", status: 401 });
  }
  const { data: profile } = await supabase.from("user_profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) {
    throw new GuardrailError({ code: "FORBIDDEN", where: "/api/admin/feedback/github-comments#GET", message: "Admin access required.", status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const issueNumber = searchParams.get("issueNumber");

  if (!issueNumber) {
    return NextResponse.json(
      { error: "issueNumber query param is required" },
      { status: 400 },
    );
  }

  const owner = process.env.GITHUB_FEEDBACK_REPO_OWNER;
  const repo = process.env.GITHUB_FEEDBACK_REPO_NAME;
  const token = process.env.GITHUB_FEEDBACK_TOKEN;

  if (!owner || !repo) {
    throw new GuardrailError({ code: "INTERNAL_ERROR", where: "/api/admin/feedback/github-comments#GET", message: "GitHub feedback repo not configured." });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "alleato-pm-feedback",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    { headers, next: { revalidate: 30 } },
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `GitHub API error: ${res.status}`, detail: text },
      { status: res.status },
    );
  }

  const comments = await res.json();
  return NextResponse.json({ comments });
});
