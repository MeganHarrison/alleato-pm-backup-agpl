import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { PermissionService } from "@/services/permissionService";
import { DirectoryService } from "@/services/directoryService";

/** Parses a stored data URL avatar into response bytes and MIME type. */
function parseDataUrlAvatar(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || "image/png",
    buffer: Buffer.from(match[2], "base64"),
  };
}

export const GET = withApiGuardrails(
  "avatar/[personId]#GET",
  async ({ request, params }) => {
    const { personId } = params as { personId: string };
    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId query parameter is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "avatar/[personId]#GET",
        message: "Authentication required.",
      });
    }

    const permissionService = new PermissionService(supabase);
    await permissionService.requirePermission(
      user.id,
      projectId,
      "directory",
      "read",
    );

    // Ensure the requested person is visible within the project context.
    const directoryService = new DirectoryService(supabase);
    try {
      await directoryService.getPerson(projectId, personId);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await serviceDb.from("people")
      .select("profile_photo_url")
      .eq("id", personId)
      .maybeSingle();

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "avatar/[personId]#GET",
        message: error.message,
      });
    }

    if (!data?.profile_photo_url) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsedAvatar = parseDataUrlAvatar(data.profile_photo_url);
    if (!parsedAvatar) {
      return NextResponse.json({ error: "Invalid avatar data" }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(parsedAvatar.buffer), {
      headers: {
        "Content-Type": parsedAvatar.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  },
);
