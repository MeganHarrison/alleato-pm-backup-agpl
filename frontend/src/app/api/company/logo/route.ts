import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { apiErrorResponse } from "@/lib/api-error";

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const BUCKET_NAME = "company-logos";
const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

async function ensureBucket() {
  const supabase = createServiceClient();
  const { error: getBucketError } = await supabase.storage.getBucket(BUCKET_NAME);

  if (getBucketError) {
    const msg = getBucketError.message?.toLowerCase() ?? "";
    const isNotFound = msg.includes("not found") || msg.includes("does not exist");
    if (!isNotFound) {
      return { ok: false as const, error: getBucketError.message };
    }
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
    });
    if (createError) {
      return { ok: false as const, error: createError.message };
    }
  }
  return { ok: true as const };
}

export const POST = withApiGuardrails(
  "company/logo#POST",
  async ({ request }) => {
  
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "company/logo#POST", message: "Authentication required." });
    }

    const bucketReady = await ensureBucket();
    if (!bucketReady.ok) {
      return NextResponse.json(
        { error: "Storage bucket not available", details: bucketReady.error },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const companyId = formData.get("companyId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use PNG, JPG, SVG, or WEBP." },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: "Image must be smaller than 2 MB" }, { status: 400 });
    }

    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/svg+xml": "svg",
      "image/webp": "webp",
    };
    const ext = extMap[file.type] || "png";
    const filePath = `logos/${companyId || user.id}-${Date.now()}.${ext}`;

    const supabase = createServiceClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed", details: uploadError.message },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    // If a companyId was provided, update the companies table
    if (companyId && typeof companyId === "string") {
      await serviceDb.from("companies")
        .update({ logo_url: publicUrl })
        .eq("id", companyId);
    }

    return NextResponse.json({ logoUrl: publicUrl });
    },
);
