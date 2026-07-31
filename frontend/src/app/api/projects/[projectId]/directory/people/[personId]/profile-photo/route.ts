import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { Buffer } from "node:buffer";
import { NextResponse, type NextRequest } from "next/server";
import { verifyProjectAccess, isAuthError } from "@/lib/supabase/auth-guard";
import { PermissionService } from "@/services/permissionService";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Encodes the uploaded avatar into a data URL stored on the person record. */
function toDataUrl(contentType: string, arrayBuffer: ArrayBuffer): string {
  const dataBase64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${dataBase64}`;
}

interface RouteParams {
  params: Promise<{ projectId: string; personId: string }>;
}

export const POST = withApiGuardrails(
  "projects/[projectId]/directory/people/[personId]/profile-photo#POST",
  async ({ request, params }) => {
  
    const { projectId, personId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const authResult = await verifyProjectAccess(projectIdNum);
    if (isAuthError(authResult)) return authResult;
    const serviceSupabase = authResult.serviceClient;

    // Still need regular auth client for permission check
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/directory/people/[personId]/profile-photo#POST", message: "Authentication required." });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "write",
    );

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 2MB limit" },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const profilePhotoUrl = toDataUrl(file.type, arrayBuffer);

    await serviceSupabase
      .from("people")
      .update({
        profile_photo_url: profilePhotoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", personId);

    return NextResponse.json({ success: true });
    },
);
