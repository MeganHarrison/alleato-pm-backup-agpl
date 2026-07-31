import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withApiGuardrails, parseJsonBody } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

const actionSchema = z.object({
  candidateId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

type CandidateRow = {
  id: string;
  source_document_id: string;
  candidate_project_id: number | null;
  candidate_project_name: string | null;
  confidence: number | null;
  attribution_method: string | null;
  evidence_terms: string[] | null;
  reasoning: string | null;
  status: string;
  created_at: string | null;
};

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in before reviewing project attribution candidates.",
      status: 401,
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
      message: "Admin access is required to review project attribution candidates.",
      status: 403,
    });
  }

  return user;
}

export const GET = withApiGuardrails(
  "api.admin.project-attribution-candidates.GET",
  async ({ request }) => {
    await requireAdmin("api.admin.project-attribution-candidates.GET");

    const status = request.nextUrl.searchParams.get("status") ?? "pending_review";
    const limit = Math.min(
      500,
      Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 100)),
    );
    const serviceSupabase = createServiceClient();
    const ragSupabase = createRagServiceClient();

    const { data: candidates, error } = await ragSupabase
      .from("document_attribution_candidates")
      .select(
        "id, source_document_id, candidate_project_id, candidate_project_name, confidence, attribution_method, evidence_terms, reasoning, status, created_at",
      )
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.project-attribution-candidates.GET",
        message: "Failed to load project attribution candidates.",
        details: error.message,
      });
    }

    const rows = (candidates ?? []) as CandidateRow[];
    const documentIds = Array.from(new Set(rows.map((row) => row.source_document_id)));
    const documentsById = new Map<string, Record<string, unknown>>();

    if (documentIds.length > 0) {
      const { data: documents, error: documentError } = await serviceDb.from("document_metadata")
        .select("id, title, source, category, type, project_id, project, date, created_at, summary, overview, content, participants")
        .in("id", documentIds);

      if (documentError) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.project-attribution-candidates.GET",
          message: "Failed to load documents for attribution candidates.",
          details: documentError.message,
        });
      }

      for (const document of documents ?? []) {
        documentsById.set(String(document.id), document);
      }
    }

    return NextResponse.json({
      candidates: rows.map((candidate) => ({
        ...candidate,
        document: documentsById.get(candidate.source_document_id) ?? null,
      })),
    });
  },
);

export const POST = withApiGuardrails(
  "api.admin.project-attribution-candidates.POST",
  async ({ request }) => {
    const user = await requireAdmin("api.admin.project-attribution-candidates.POST");
    const body = await parseJsonBody(
      request,
      actionSchema,
      "api.admin.project-attribution-candidates.POST",
    );
    const serviceSupabase = createServiceClient();
    const ragSupabase = createRagServiceClient();

    const { data: candidate, error: candidateError } = await ragSupabase
      .from("document_attribution_candidates")
      .select("id, source_document_id, candidate_project_id, candidate_project_name, status")
      .eq("id", body.candidateId)
      .single();

    if (candidateError || !candidate) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "api.admin.project-attribution-candidates.POST",
        message: "Project attribution candidate was not found.",
        status: 404,
        details: candidateError?.message,
      });
    }

    if (candidate.status !== "pending_review") {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api.admin.project-attribution-candidates.POST",
        message: "Only pending project attribution candidates can be reviewed.",
        status: 409,
        details: { status: candidate.status },
      });
    }

    if (body.action === "reject") {
      const { error } = await ragSupabase
        .from("document_attribution_candidates")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", body.candidateId);

      if (error) {
        throw new GuardrailError({
          code: "UPSTREAM_FAILURE",
          where: "api.admin.project-attribution-candidates.POST",
          message: "Failed to reject project attribution candidate.",
          details: error.message,
        });
      }

      return NextResponse.json({ ok: true, action: "reject" });
    }

    if (!candidate.candidate_project_id) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "api.admin.project-attribution-candidates.POST",
        message: "Candidate cannot be approved because it has no project id.",
        status: 409,
      });
    }

    const { data: document, error: documentError } = await serviceDb.from("document_metadata")
      .select("id, tags")
      .eq("id", candidate.source_document_id)
      .single();

    if (documentError || !document) {
      throw new GuardrailError({
        code: "ROUTE_BINDING_MISSING",
        where: "api.admin.project-attribution-candidates.POST",
        message: "Linked document was not found.",
        status: 404,
        details: documentError?.message,
      });
    }

    const tags = String(document.tags ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!tags.includes("project_backfill:admin_approved")) {
      tags.push("project_backfill:admin_approved");
    }

    const { error: documentUpdateError } = await serviceDb.from("document_metadata")
      .update({
        project_id: candidate.candidate_project_id,
        project: candidate.candidate_project_name,
        tags: tags.join(","),
      })
      .eq("id", candidate.source_document_id);

    if (documentUpdateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.project-attribution-candidates.POST",
        message: "Failed to apply approved project attribution.",
        details: documentUpdateError.message,
      });
    }

    const { error: candidateUpdateError } = await ragSupabase
      .from("document_attribution_candidates")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", body.candidateId);

    if (candidateUpdateError) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "api.admin.project-attribution-candidates.POST",
        message: "Project was assigned, but candidate review status failed to update.",
        details: candidateUpdateError.message,
      });
    }

    return NextResponse.json({ ok: true, action: "approve" });
  },
);
