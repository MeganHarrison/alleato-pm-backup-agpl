export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GuardrailError } from "@/lib/guardrails/errors";
import { ADMIN_FEEDBACK_BUCKET } from "@/lib/admin-feedback/constants";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

export const POST = withApiGuardrails(
  "admin/feedback/board/upload#POST",
  async ({ request }) => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "FORBIDDEN", where: "board/upload#POST", message: "Sign in required.", status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      throw new GuardrailError({ code: "VALIDATION", where: "board/upload#POST", message: "No file provided.", status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new GuardrailError({ code: "VALIDATION", where: "board/upload#POST", message: "File exceeds 10 MB limit.", status: 413 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new GuardrailError({ code: "VALIDATION", where: "board/upload#POST", message: "File type not allowed. Use JPEG, PNG, GIF, WebP, or SVG.", status: 415 });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const filePath = `board/${user.id}/${crypto.randomUUID()}.${ext}`;

    const supabase = createServiceClient();

    // Ensure bucket exists and is public
    const { error: bucketCheckError } = await supabase.storage.getBucket(ADMIN_FEEDBACK_BUCKET);
    if (bucketCheckError?.message?.includes("not found")) {
      await supabase.storage.createBucket(ADMIN_FEEDBACK_BUCKET, { public: true });
    } else if (bucketCheckError) {
      await supabase.storage.updateBucket(ADMIN_FEEDBACK_BUCKET, { public: true });
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(ADMIN_FEEDBACK_BUCKET)
      .upload(filePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(ADMIN_FEEDBACK_BUCKET)
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl }, { status: 201 });
  }
);
