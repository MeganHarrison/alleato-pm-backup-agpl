import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";

function reportPdfProxySignedUrlFailure(details: Record<string, unknown>) {
  console.warn(JSON.stringify({
    event: "drawing_pdf_proxy_signed_url_failed",
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

interface DrawingPdfSource {
  fileUrl: string;
  fileSize: number | null;
  fileType: string | null;
}

async function getDrawingPdfSource(drawingId: string): Promise<DrawingPdfSource | null> {
  const { data: drawing, error } = await serviceDb.from("drawings")
    .select("current_revision:drawing_revisions!fk_drawings_current_revision(file_url,file_size,file_type)")
    .eq("id", drawingId)
    .single();

  if (error || !drawing?.current_revision) return null;
  const revision = Array.isArray(drawing.current_revision)
    ? drawing.current_revision[0]
    : drawing.current_revision;
  if (!revision.file_url) return null;

  return {
    fileUrl: revision.file_url,
    fileSize: revision.file_size,
    fileType: revision.file_type,
  };
}

function pdfResponseHeaders(source: DrawingPdfSource) {
  const headers = new Headers();
  headers.set("Content-Type", source.fileType || "application/pdf");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");
  if (source.fileSize !== null) headers.set("Content-Length", String(source.fileSize));
  return headers;
}

export const HEAD = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/pdf-proxy#HEAD",
  async ({ params }) => {
    const user = await getApiRouteUser();
    if (!user) return new NextResponse(null, { status: 401 });

    const { drawingId } = await params;
    const source = await getDrawingPdfSource(drawingId);
    if (!source) return new NextResponse(null, { status: 404 });

    return new NextResponse(null, { status: 200, headers: pdfResponseHeaders(source) });
  },
);

/**
 * GET /api/projects/[projectId]/drawings/[drawingId]/pdf-proxy
 *
 * Proxies the drawing PDF through Next.js so that react-pdf (PDF.js) can make
 * HTTP Range requests without hitting Supabase signed-URL CORS/range restrictions
 * that cause a 400 "Unexpected server response" error.
 */
export const GET = withApiGuardrails<{ projectId: string; drawingId: string }>(
  "projects/[projectId]/drawings/[drawingId]/pdf-proxy#GET",
  async ({ request, params }) => {
  const user = await getApiRouteUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { drawingId } = await params;
  const serviceClient = createServiceClient();

  const source = await getDrawingPdfSource(drawingId);
  if (!source) return new NextResponse("Drawing file not found", { status: 404 });
  const { fileUrl } = source;

  // Extract storage path from the public URL and create a fresh signed URL
  let fetchUrl = fileUrl;
  try {
    const parsed = new URL(fileUrl);
    const pathParts = parsed.pathname.split("/object/public/project-files/");
    if (pathParts.length === 2) {
      const storagePath = pathParts[1];
      const { data: signedData } = await serviceClient.storage
        .from("project-files")
        .createSignedUrl(storagePath, 300); // 5 min — only needs to last for this request
      if (signedData?.signedUrl) {
        fetchUrl = signedData.signedUrl;
      }
    }
  } catch (error) {
    reportPdfProxySignedUrlFailure({
      drawingId,
      fileUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const rangeHeader = request.headers.get("range");
  const upstreamHeaders: HeadersInit = { Accept: "application/pdf, */*" };
  if (rangeHeader) {
    upstreamHeaders["Range"] = rangeHeader;
  }

  const upstream = await fetch(fetchUrl, { headers: upstreamHeaders });

  // Don't forward non-ok Supabase responses as-is — they contain raw JSON that
  // would render visibly inside an <iframe> or <object> element.
  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse(null, { status: upstream.status });
  }

  const responseHeaders = pdfResponseHeaders(source);
  responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || source.fileType || "application/pdf");

  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) responseHeaders.set("Content-Length", contentLength);

  const contentRange = upstream.headers.get("Content-Range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
  },
);
