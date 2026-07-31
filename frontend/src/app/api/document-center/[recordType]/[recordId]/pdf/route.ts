import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";

import { getApiRouteUserFromRequest } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getDocumentPdfOptions,
  getDocumentBundle,
  renderDocumentHtml,
  type DocumentRecordType,
} from "@/lib/documents/record-documents";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { logger } from "@/lib/logger";

interface RouteParams {
  params: Promise<{
    recordType: string;
    recordId: string;
  }>;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isDocumentRecordType(value: string): value is DocumentRecordType {
  return (
    value === "prime-contract" ||
    value === "commitment" ||
    value === "change-order" ||
    value === "prime-contract-change-order"
  );
}

export const GET = withApiGuardrails(
  "document-center/[recordType]/[recordId]/pdf#GET",
  async ({ request, params }) => {
  
    const { recordType, recordId } = await params;
    if (!isDocumentRecordType(recordType)) {
      return NextResponse.json({ error: "Unsupported record type" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const user = await getApiRouteUserFromRequest(request);

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "document-center/[recordType]/[recordId]/pdf#GET", message: "Authentication required." });
    }

    const bundle = await getDocumentBundle(supabase, recordType, recordId);
    const html = renderDocumentHtml(bundle);
    const pdfOptions = getDocumentPdfOptions(bundle);
    try {
      const pdfBuffer = await renderPdfFromHtml(html, pdfOptions);

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${bundle.filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (pdfError) {
      logger.error({
        msg: "[document-center/pdf] PDF generation failed",
        recordType,
        recordId,
        error: pdfError instanceof Error ? pdfError.message : String(pdfError),
      });

      return NextResponse.json({
        error: "PDF generation failed",
        details: pdfError instanceof Error ? pdfError.message : String(pdfError),
      }, {
        status: 500,
      });
    }
    },
);
