import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { buildCanonicalDailyBriefPdfHtml } from "@/lib/daily-briefs/brief-pdf";
import { loadDailyExecutiveBriefPacketById } from "@/lib/daily-briefs/canonical-packets";
import {
  buildBrandedFooterTemplate,
  BRANDED_FOOTER_MARGIN,
} from "@/lib/documents/branded-letterhead";
import { renderPdfFromHtml } from "@/lib/documents/pdf";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

// Puppeteer/@sparticuz/chromium requires the Node.js runtime — not Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHERE = "/api/executive/daily-brief/[briefId]/pdf#GET";

/**
 * GET /api/executive/daily-brief/[briefId]/pdf
 *
 * On-demand, branded PDF render of a canonical Daily / Morning Brief packet.
 * This is what the Teams "Download PDF" button links to — generating at click
 * time means the PDF is always fresh and never has to be stored. Guarded by the
 * same `view_executive_briefing` capability that gates the brief page, so a
 * bot-delivered link cannot leak the brief to an unauthenticated visitor.
 */
export const GET = withApiGuardrails<{ briefId: string }>(
  WHERE,
  async ({ params }) => {
    await requireCurrentUserExecutiveDetail(WHERE);

    const { briefId } = await params;
    const packet = await loadDailyExecutiveBriefPacketById(briefId);
    if (!packet) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Daily Brief not found.",
        status: 404,
      });
    }

    const html = buildCanonicalDailyBriefPdfHtml(packet);
    const pdfBuffer = await renderPdfFromHtml(html, {
      footerTemplate: buildBrandedFooterTemplate(),
      marginBottom: BRANDED_FOOTER_MARGIN,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="morning-brief-${packet.businessDate}.pdf"`,
        // Briefs are recompiled through the day; never let a proxy cache one.
        "Cache-Control": "no-store, max-age=0",
      },
    });
  },
);
