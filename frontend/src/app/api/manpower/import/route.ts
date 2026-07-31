import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  buildAssignmentInsertRows,
  buildProjectInsertRows,
  getActiveManpowerPayload,
  resolveImportContext,
} from "@/features/manpower/server";
import { parseManpowerCsv } from "@/features/manpower/parser";

const MANPOWER_IMPORT_FILE_LIMIT_BYTES = 10 * 1024 * 1024;

export const runtime = "nodejs";

async function extractImportPayload(request: Request): Promise<{ csvText: string; sourceLabel: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("A CSV file is required.");
    }
    if (file.size > MANPOWER_IMPORT_FILE_LIMIT_BYTES) {
      throw new Error("Manpower CSV files must be smaller than 10 MB.");
    }
    return {
      csvText: await file.text(),
      sourceLabel: file.name,
    };
  }

  const body = (await request.json()) as { csvText?: string; sourceLabel?: string };
  if (!body.csvText?.trim()) {
    throw new Error("CSV text is required.");
  }

  return {
    csvText: body.csvText,
    sourceLabel: body.sourceLabel?.trim() || "Imported CSV",
  };
}

export const POST = withApiGuardrails(
  "manpower/import#POST",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "manpower/import#POST",
        message: "Authentication required.",
      });
    }

    try {
      const importPayload = await extractImportPayload(request);
      const parsed = parseManpowerCsv(importPayload.csvText, {
        sourceLabel: importPayload.sourceLabel,
      });
      const context = await resolveImportContext(supabase);

      const { data: insertedPlan, error: insertPlanError } = await supabase
        .from("manpower_plans")
        .insert({
          source_label: parsed.sourceLabel,
          imported_at: parsed.importedAt,
          imported_by_person_id: context.importedByPersonId,
          warning_count: parsed.warnings.length,
          is_active: false,
        })
        .select("id")
        .single();

      if (insertPlanError || !insertedPlan) {
        throw insertPlanError ?? new Error("The manpower plan could not be created.");
      }

      try {
        const projectRows = buildProjectInsertRows(insertedPlan.id, parsed, context);
        const { data: insertedProjects, error: insertProjectsError } = await supabase
          .from("manpower_projects")
          .insert(projectRows)
          .select("*");

        if (insertProjectsError || !insertedProjects) {
          throw insertProjectsError ?? new Error("The manpower projects could not be created.");
        }

        const assignmentRows = buildAssignmentInsertRows(
          insertedPlan.id,
          parsed,
          insertedProjects,
          context,
        );
        const { error: insertAssignmentsError } = await supabase
          .from("manpower_assignments")
          .insert(assignmentRows);

        if (insertAssignmentsError) {
          throw insertAssignmentsError;
        }

        const { error: deactivateError } = await supabase
          .from("manpower_plans")
          .update({ is_active: false })
          .eq("is_active", true)
          .neq("id", insertedPlan.id);
        if (deactivateError) throw deactivateError;

        const { error: activateError } = await supabase
          .from("manpower_plans")
          .update({ is_active: true })
          .eq("id", insertedPlan.id);
        if (activateError) throw activateError;
      } catch (error) {
        await supabase.from("manpower_plans").delete().eq("id", insertedPlan.id);
        throw error;
      }

      const payload = await getActiveManpowerPayload(supabase);
      return NextResponse.json(payload);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to import manpower CSV." },
        { status: 422 },
      );
    }
  },
);
