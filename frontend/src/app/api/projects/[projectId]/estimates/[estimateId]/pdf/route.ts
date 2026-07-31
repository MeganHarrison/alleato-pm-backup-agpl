import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  buildEstimatePrintHtml,
  calculateDurationWeeks,
  computeEstimateDetailDivisionTotal,
  computeEstimateGcTotal,
  getEstimatePdfFilename,
} from "@/lib/estimates/estimate-pdf";
import { renderPdfFromHtml } from "@/lib/documents/pdf";

export const runtime = "nodejs";

const WHERE = "projects/[projectId]/estimates/[estimateId]/pdf#GET";

export const GET = withApiGuardrails<{ projectId: string; estimateId: string }>(
  WHERE,
  async ({ params }) => {
    const { projectId, estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE,
        message: "Authentication required.",
      });
    }

    const projectIdNum = parseInt(projectId, 10);
    const estimateIdNum = parseInt(estimateId, 10);

    if (!Number.isFinite(projectIdNum) || !Number.isFinite(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: WHERE,
        message: "Invalid project or estimate ID.",
        details: { projectId, estimateId },
      });
    }

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("*")
      .eq("estimate_id", estimateIdNum)
      .eq("project_id", projectIdNum)
      .eq("is_deleted", false)
      .single();

    if (estimateError || !estimate) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Estimate not found for this project.",
        details: { projectId, estimateId },
      });
    }

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectIdNum)
      .single();

    if (projectError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: projectError.message,
        cause: projectError,
      });
    }

    const { data: gcItems, error: gcError } = await supabase
      .from("estimate_gc_items")
      .select("*")
      .eq("estimate_id", estimateIdNum)
      .order("sort_order", { ascending: true });

    if (gcError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: gcError.message,
        cause: gcError,
      });
    }

    const { data: detailItems, error: detailError } = await supabase
      .from("estimate_detail_items")
      .select("*")
      .eq("estimate_id", estimateIdNum)
      .order("division_code", { ascending: true })
      .order("sort_order", { ascending: true });

    if (detailError) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: detailError.message,
        cause: detailError,
      });
    }

    const durationMonths = estimate.project_duration_months ?? 0;
    const durationWeeks = calculateDurationWeeks(durationMonths);
    const normalizedGcItems = gcItems ?? [];
    const normalizedDetailItems = detailItems ?? [];

    const gcTotal = computeEstimateGcTotal(
      normalizedGcItems,
      durationMonths,
      durationWeeks,
    );
    const detailTotalsByDiv = normalizedDetailItems.reduce<
      Record<string, number>
    >((acc, item) => {
      if (!item.division_code) return acc;
      acc[item.division_code] = computeEstimateDetailDivisionTotal(
        normalizedDetailItems,
        item.division_code,
      );
      return acc;
    }, {});

    const detailTotal = Object.values(detailTotalsByDiv).reduce(
      (sum, value) => sum + value,
      0,
    );
    const subtotal = gcTotal + detailTotal;
    const contingencyAmount = estimate.contingency_amount ?? 0;
    const insuranceRate = estimate.insurance_rate ?? 0.0125;
    const feeRate = estimate.fee_rate ?? 0.1;
    const insurance = Math.round(subtotal * insuranceRate * 100) / 100;
    const fee = Math.round((subtotal + insurance) * feeRate * 100) / 100;
    const grandTotal = subtotal + contingencyAmount + insurance + fee;

    const html = buildEstimatePrintHtml({
      estimate,
      projectName: project?.name ?? `Project ${projectId}`,
      gcTotal,
      detailTotalsByDiv,
      subtotal,
      contingencyAmount,
      insurance,
      insuranceRate,
      fee,
      feeRate,
      grandTotal,
    });

    const pdfBuffer = await renderPdfFromHtml(html);
    const filename = getEstimatePdfFilename(estimate);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
