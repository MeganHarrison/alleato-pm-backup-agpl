import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-guard";

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/psr/comments?month=YYYY-MM
// Returns all PSR comments for a project + month.
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/psr/comments#GET",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const month =
      url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid month format. Use YYYY-MM." },
        { status: 400 },
      );
    }

    const developerGuard = await requireDeveloperApi();
    if (developerGuard) return developerGuard;

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("psr_comments")
      .select("section, body, updated_at")
      .eq("project_id", projectIdNum)
      .eq("month", month)
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch PSR comments", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(data ?? []);
  },
);

// ---------------------------------------------------------------------------
// POST /api/projects/[projectId]/psr/comments
// Upserts a single comment (idempotent via UNIQUE(project_id, month, section)).
// Body: { month: string, section: string, body: string }
// ---------------------------------------------------------------------------

export const POST = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/psr/comments#POST",
  async ({ request, params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 },
      );
    }

    const developerGuard = await requireDeveloperApi();
    if (developerGuard) return developerGuard;

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const user = await getApiRouteUser();

    let body: { month?: string; section?: string; body?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { month, section, body: commentBody } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: "Invalid or missing month. Use YYYY-MM." },
        { status: 400 },
      );
    }
    if (!section || typeof section !== "string") {
      return NextResponse.json(
        { error: "Missing section identifier." },
        { status: 400 },
      );
    }
    if (typeof commentBody !== "string") {
      return NextResponse.json(
        { error: "Missing comment body." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("psr_comments")
      .upsert(
        {
          project_id: projectIdNum,
          month,
          section,
          body: commentBody,
          created_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,month,section" },
      )
      .select("section, body, updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to save PSR comment", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  },
);
