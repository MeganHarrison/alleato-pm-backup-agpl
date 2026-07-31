/**
 * /api/testing/runs/[runId]/results/[resultId]/screenshots
 * POST — upload a screenshot (base64 or multipart) and link to a test result
 */
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const POST = withApiGuardrails<{ runId: string; resultId: string }>(
  "testing/runs/[runId]/results/[resultId]/screenshots#POST",
  async ({ request, params }) => {
  const { runId, resultId } = await params;
  const supabase = await createClient();
  const service = createServiceClient();

  const body = await request.json();
  const { dataUrl, label } = body as { dataUrl: string; label?: string };

  if (!dataUrl) {
    return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
  }

  // Decode base64
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg";
  const storagePath = `${runId}/${resultId}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await service.storage
    .from("test-screenshots")
    .upload(storagePath, buffer, {
      contentType: ext === "png" ? "image/png" : "image/jpeg",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Get a signed URL (bucket is private)
  const { data: signedData, error: signErr } = await service.storage
    .from("test-screenshots")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

  const publicUrl = signErr ? null : signedData?.signedUrl ?? null;

  const { data: screenshot, error: dbErr } = await supabase
    .from("test_screenshots")
    .insert({ result_id: resultId, storage_path: storagePath, public_url: publicUrl, label: label ?? null })
    .select("id, storage_path, public_url, label, created_at")
    .single();

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ screenshot });
  },
);
