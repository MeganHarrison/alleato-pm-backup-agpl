import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ProjectDocumentRow = {
  id: number;
  project_id: number;
  folder: string | null;
  title: string;
  description: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  content_type: string | null;
  version: number | null;
  status: string;
  category: string | null;
  document_type: string | null;
  is_private: boolean | null;
  source_system: string | null;
  source_drive_id: string | null;
  source_item_id: string | null;
  source_site_id: string | null;
  source_path: string | null;
  source_web_url: string | null;
  source_etag: string | null;
  source_last_modified_at: string | null;
  source_size: number | null;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  content_hash: string | null;
  workflow_target: string | null;
  division: string | null;
  trade: string | null;
  source_metadata: unknown;
  uploaded_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  projects:
    | {
        name: string | null;
        project_number: string | null;
      }
    | Array<{
        name: string | null;
        project_number: string | null;
      }>
    | null;
};

export const GET = withApiGuardrails(
  "project-documents#GET",
  async () => {
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "project-documents#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("project_documents")
      .select("*, projects(name, project_number)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return apiErrorResponse(error);
    }

    const rows = ((data ?? []) as ProjectDocumentRow[]).map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      return {
        ...row,
        project_name: project?.name ?? null,
        project_number: project?.project_number ?? null,
      };
    });

    return NextResponse.json(rows);
  },
);
