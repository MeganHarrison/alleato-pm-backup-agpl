export const runtime = "nodejs";

import type React from "react";
import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { requireDeveloperApi } from "@/lib/auth/require-developer";
import { requirePermission } from "@/lib/permissions-guard";
import { apiFetch } from "@/lib/api-client";
import type { PsrApiResponse } from "@/types/psr.types";

// ---------------------------------------------------------------------------
// GET /api/projects/[projectId]/psr/export?month=YYYY-MM
// Generates and streams a PDF of the PSR.
//
// Uses @react-pdf/renderer — requires Node.js runtime (not edge-compatible).
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/psr/export#GET",
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

    const developerGuard = await requireDeveloperApi();
    if (developerGuard) return developerGuard;

    const guard = await requirePermission(projectIdNum, "budget", "read");
    if (guard.denied) return guard.response;

    // Fetch PSR data via the aggregation route
    // We call the internal API using the request's host so auth cookies flow through
    const baseUrl = `${url.protocol}//${url.host}`;
    let psrData: PsrApiResponse;
    try {
      const res = await fetch(
        `${baseUrl}/api/projects/${projectId}/psr?month=${month}`,
        {
          headers: {
            // Forward cookies for auth
            cookie: request.headers.get("cookie") ?? "",
          },
        },
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: "Failed to fetch PSR data for PDF generation" },
          { status: res.status },
        );
      }
      psrData = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Failed to fetch PSR data" },
        { status: 500 },
      );
    }

    // Render PDF using @react-pdf/renderer
    type PdfRenderFn = (element: React.ReactElement) => Promise<Buffer>;
    type PsrDocumentComponent = React.ComponentType<{ data: PsrApiResponse; month: string }>;
    let renderToBuffer: PdfRenderFn;
    let PsrDocument: PsrDocumentComponent;
    try {
      // Dynamic imports so missing package produces a runtime error, not a build error
      const reactPdf = await import("@react-pdf/renderer");
      renderToBuffer = reactPdf.renderToBuffer as PdfRenderFn;
      const docModule = await import("./PsrDocument");
      PsrDocument = docModule.PsrDocument as PsrDocumentComponent;
    } catch {
      return NextResponse.json(
        {
          error: "PDF generation unavailable",
          hint: "Run: cd frontend && npm install @react-pdf/renderer",
        },
        { status: 501 },
      );
    }

    try {
      const { createElement } = await import("react");
      const element = createElement(PsrDocument, { data: psrData, month });
      const buffer: Buffer = await renderToBuffer(element);
      const uint8 = new Uint8Array(buffer);

      return new Response(uint8, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="PSR-Project${projectId}-${month}.pdf"`,
          "Content-Length": String(uint8.byteLength),
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "PDF generation failed";
      return NextResponse.json(
        { error: "PDF generation failed", details: message },
        { status: 500 },
      );
    }
  },
);

// Suppress unused import warning — apiFetch is available for internal use
void apiFetch;
