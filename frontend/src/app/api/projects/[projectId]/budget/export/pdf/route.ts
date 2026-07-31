import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { buildBudgetPdfHtml } from "@/lib/budget-pdf";
import {
  BudgetFetchError,
  computeBudgetGrandTotals,
} from "@/lib/budget/compute-grand-totals";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { requirePermission } from "@/lib/permissions-guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/projects/[projectId]/budget/export/pdf — printable budget PDF
export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/budget/export/pdf#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (Number.isNaN(projectIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "projects/[projectId]/budget/export/pdf#GET",
        message: "Invalid project ID.",
        status: 400,
        severity: "low",
      });
    }

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    const supabase = await createClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name, project_number")
      .eq("id", projectIdNum)
      .single();

    if (projectError) {
      return apiErrorResponse(projectError);
    }

    let lineItems;
    let grandTotals;
    try {
      ({ lineItems, grandTotals } = await computeBudgetGrandTotals(
        supabase,
        projectIdNum,
      ));
    } catch (error) {
      if (error instanceof BudgetFetchError) {
        return apiErrorResponse(error.cause);
      }
      throw error;
    }

    const html = buildBudgetPdfHtml({
      projectName: project?.name ?? null,
      projectNumber: project?.project_number ? String(project.project_number) : null,
      lineItems,
      grandTotals,
    });

    const pdfBuffer = await renderPdfFromHtml(html, { landscape: true });
    const safeProject = (project?.name || "project")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeProject || "project"}-budget.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
