import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api-error";
import { assertCrmOwnerOrAdmin, requireCrmAccess } from "@/lib/crm/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function hasExpectedSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png")
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  if (mimeType === "image/webp")
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}

async function loadLead(leadId: string, level: "read" | "write") {
  if (!z.string().uuid().safeParse(leadId).success) {
    throw new GuardrailError({
      code: "VALIDATION_ERROR",
      where: "crm/leads/[leadId]/photo",
      message: "A valid CRM lead is required.",
      status: 400,
    });
  }
  const access = await requireCrmAccess(level);
  const { data, error } = await access.db
    .from("crm_leads")
    .select("id, owner_person_id, photo_storage_path")
    .eq("id", leadId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "crm/leads/[leadId]/photo",
      message: "Lead not found.",
      status: 404,
    });
  return { ...access, lead: data };
}

export const GET = withApiGuardrails(
  "crm/leads/[leadId]/photo#GET",
  async ({ params }) => {
    const { leadId } = await params;
    const { db, lead, personId, isAdmin } = await loadLead(leadId, "read");
    assertCrmOwnerOrAdmin({
      ownerPersonId: lead.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]/photo#GET",
    });
    if (!lead.photo_storage_path)
      return NextResponse.json({ data: { url: null } });
    const { data, error } = await db.storage
      .from("crm-lead-photos")
      .createSignedUrl(lead.photo_storage_path, 3600);
    if (error) return apiErrorResponse(error);
    return NextResponse.json({ data: { url: data.signedUrl } });
  },
);

export const POST = withApiGuardrails(
  "crm/leads/[leadId]/photo#POST",
  async ({ request, params }) => {
    const { leadId } = await params;
    const { db, lead, personId, isAdmin } = await loadLead(leadId, "write");
    assertCrmOwnerOrAdmin({
      ownerPersonId: lead.owner_person_id,
      personId,
      isAdmin,
      action: "crm/leads/[leadId]/photo#POST",
    });
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > 2 * 1024 * 1024 + 64 * 1024
    ) {
      return NextResponse.json(
        { message: "Use a lead photo no larger than 2 MB." },
        { status: 413 },
      );
    }
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File))
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/photo#POST",
        message: "Choose a lead photo.",
        status: 400,
      });
    const extension = ALLOWED_TYPES.get(file.type);
    if (!extension || file.size <= 0 || file.size > 2 * 1024 * 1024)
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/photo#POST",
        message: "Use a JPG, PNG, or WebP image no larger than 2 MB.",
        status: 400,
      });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedSignature(bytes, file.type)) {
      throw new GuardrailError({
        code: "VALIDATION_ERROR",
        where: "crm/leads/[leadId]/photo#POST",
        message: "The selected file does not contain a valid supported image.",
        status: 400,
      });
    }
    const path = `${lead.owner_person_id}/${lead.id}/profile.${extension}`;
    const { error: uploadError } = await db.storage
      .from("crm-lead-photos")
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (uploadError) return apiErrorResponse(uploadError);
    const { error: updateError } = await db
      .from("crm_leads")
      .update({ photo_storage_path: path })
      .eq("id", lead.id);
    if (updateError) return apiErrorResponse(updateError);
    const { data, error: signedError } = await db.storage
      .from("crm-lead-photos")
      .createSignedUrl(path, 3600);
    if (signedError) return apiErrorResponse(signedError);
    return NextResponse.json({ data: { url: data.signedUrl } });
  },
);
