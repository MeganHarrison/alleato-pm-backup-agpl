import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";

interface ProjectSpecificationRevision {
  id: number;
  section_id: number;
  section_number: string;
  section_title: string;
  revision_number: number;
  file_name: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
  notes: string | null;
}

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/specifications/revisions#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/specifications/revisions#GET",
        message: "Authentication required.",
      });
    }

    const projectIdNum = Number.parseInt(projectId, 10);
    if (!Number.isFinite(projectIdNum)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "projects/[projectId]/specifications/revisions#GET",
        message: "Invalid project ID.",
      });
    }

        const { data, error } = await serviceDb.from("specification_section_revisions")
      .select(
        "id, section_id, revision_number, file_name, file_size, uploaded_at, uploaded_by, notes, specification_sections!specification_section_revisions_section_id_fkey!inner(section_number, title, project_id)",
      )
      .eq("specification_sections.project_id", projectIdNum)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load specification revisions", details: error.message },
        { status: 500 },
      );
    }

    const revisions: ProjectSpecificationRevision[] = (data ?? []).map((row) => ({
      id: row.id,
      section_id: row.section_id,
      section_number: row.specification_sections?.section_number ?? "—",
      section_title: row.specification_sections?.title ?? "Untitled",
      revision_number: row.revision_number,
      file_name: row.file_name,
      file_size: row.file_size,
      uploaded_at: row.uploaded_at,
      uploaded_by: row.uploaded_by,
      notes: row.notes,
    }));

    return NextResponse.json({ revisions });
  },
);
