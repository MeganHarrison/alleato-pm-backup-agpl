import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-error";
import { buildCommitmentChangeOrderPdfArtifact } from "@/lib/change-orders/commitment-change-order-pdf";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApiGuardrails<{ projectId: string; commitmentCoId: string }>(
  "projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf#GET",
  async ({ params }) => {
    const supabase = await createClient();
    const { projectId, commitmentCoId } = params;
    const projectIdNum = Number(projectId);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf#GET",
        message: "Authentication required.",
      });
    }

    try {
      const artifact = await buildCommitmentChangeOrderPdfArtifact(
        supabase,
        projectIdNum,
        commitmentCoId,
      );
      const pdfBuffer = await renderPdfFromHtml(artifact.html, {});

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${artifact.filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) {
        throw new GuardrailError({
          code: "ROUTE_BINDING_MISSING",
          where: "projects/[projectId]/commitment-change-orders/[commitmentCoId]/pdf#GET",
          message: error.message,
          status: 404,
          severity: "low",
          details: { projectId: projectIdNum, commitmentCoId },
        });
      }

      return apiErrorResponse(error);
    }
  },
);
