import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import QRCode from "qrcode";
import { DrawingService } from "@/services/DrawingService";

export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/qr-code#GET",
  async ({ request, params }) => {
    const { projectId, drawingId } = params as { projectId: string; drawingId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/qr-code#GET",
        message: "Unauthorized",
        status: 401,
      });
    }

    const drawingService = new DrawingService(createServiceClient());
    const drawingResult = await drawingService.getById(projectId, drawingId);
    if (drawingResult.error || !drawingResult.data) {
      return NextResponse.json({ error: "Drawing not found" }, { status: 404 });
    }
    const drawing = drawingResult.data;

    // Build the deep-link URL to the viewer
    const configuredAppHost = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
    const vercelHost = process.env.VERCEL_URL?.trim();
    const appHost =
      configuredAppHost ||
      request.nextUrl.origin ||
      (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
    const viewerUrl = `${appHost}/${projectId}/drawings/viewer/${drawingId}`;

    // Generate QR code as PNG buffer
    let pngBuffer: Buffer;
    try {
      pngBuffer = await QRCode.toBuffer(viewerUrl, {
        type: "png",
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } catch (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "projects/[projectId]/drawings/[drawingId]/qr-code#GET",
        message: "Failed to generate QR code",
        status: 500,
      });
    }

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Content-Disposition": `inline; filename="${drawing.drawing_number}-qr.png"`,
      },
    });
  },
);
