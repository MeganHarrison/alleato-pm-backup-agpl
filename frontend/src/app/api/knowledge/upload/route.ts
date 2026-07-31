export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { logger } from "@/lib/logger";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

async function requireKnowledgeAdmin() {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "knowledge/upload#POST",
      message: "Authentication required.",
    });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "knowledge/upload#POST",
      message: "Unable to verify knowledge upload access.",
      cause: error.message,
    });
  }

  if (data?.is_admin !== true) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where: "knowledge/upload#POST",
      message: "Admin access is required to upload knowledge sources.",
    });
  }

  return { supabase, user };
}

export const POST = withApiGuardrails("knowledge/upload#POST", async ({ request }) => {
  const { supabase } = await requireKnowledgeAdmin();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "knowledge/upload#POST",
      message: "Choose a file before uploading.",
    });
  }

  const allowedExtensions = [".pdf", ".docx", ".doc", ".txt", ".md", ".markdown"];
  const lowerName = file.name.toLowerCase();
  const extension = lowerName.includes(".")
    ? lowerName.slice(lowerName.lastIndexOf("."))
    : "";

  if (!allowedExtensions.includes(extension)) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "knowledge/upload#POST",
      message: `Unsupported file type: ${extension || "unknown"}. Allowed: ${allowedExtensions.join(", ")}`,
    });
  }

  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "knowledge/upload#POST",
      message: "File too large. Maximum size is 50MB.",
    });
  }

  const title =
    (formData.get("title") as string | null)?.trim() ||
    file.name.replace(/\.[^/.]+$/, "");
  const tags = ((formData.get("tags") as string | null) ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const metadataId = uuidv4();
  const storagePath = `knowledge/${metadataId}/${file.name}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    logger.error({ msg: "Knowledge storage upload failed", data: uploadError });
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "knowledge/upload#POST",
      message: "File upload failed. Please try again.",
      cause: uploadError.message,
    });
  }

  const { data, error: metadataError } = await supabase
    .from("document_metadata")
    .insert({
      id: metadataId,
      title,
      category: "knowledge",
      type: "document",
      source: "knowledge_upload",
      status: "uploaded",
      file_name: file.name,
      file_path: storagePath,
      storage_bucket: "documents",
      date: new Date().toISOString().split("T")[0],
      tags: tags.join(","),
    })
    .select()
    .single();

  if (metadataError) {
    // Clean up orphaned storage file
    const { error: cleanupError } = await supabase.storage
      .from("documents")
      .remove([storagePath]);
    if (cleanupError) {
      logger.error({
        msg: "Knowledge storage cleanup failed after metadata insert error — orphaned file",
        data: { path: storagePath, error: cleanupError.message },
      });
    }
    logger.error({ msg: "Knowledge metadata insert failed", data: metadataError });
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "knowledge/upload#POST",
      message: "Failed to register document. Please try again.",
      cause: metadataError.message,
    });
  }

  return NextResponse.json({ data }, { status: 201 });
});
