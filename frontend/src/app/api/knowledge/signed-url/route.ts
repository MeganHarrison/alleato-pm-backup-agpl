export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

function getSourceDocumentUrl(doc: { source_web_url?: string | null; url?: string | null }) {
  const sourceUrl = doc.source_web_url ?? doc.url;
  if (!sourceUrl) return null;

  try {
    const parsed = new URL(sourceUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? sourceUrl
      : null;
  } catch {
    return null;
  }
}

// GET /api/knowledge/signed-url?id=<documentId>
export const GET = withApiGuardrails(
  "knowledge/signed-url#GET",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "knowledge/signed-url#GET",
        message: "Authentication required.",
      });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "knowledge/signed-url#GET",
        message: "Missing document id.",
      });
    }

    const { data: doc, error: fetchError } = await supabase
      .from("document_metadata")
      .select("file_path, storage_bucket, source_web_url, url")
      .eq("id", id)
      .eq("category", "knowledge")
      .maybeSingle();

    if (fetchError || !doc) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "knowledge/signed-url#GET",
        message: "Document not found.",
        status: 404,
      });
    }

    const sourceDocumentUrl = getSourceDocumentUrl(doc);

    if (!doc.file_path) {
      if (sourceDocumentUrl) {
        return NextResponse.json({ url: sourceDocumentUrl });
      }

      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "knowledge/signed-url#GET",
        message: "Document has no associated file or source URL.",
        status: 404,
      });
    }

    const bucket = doc.storage_bucket ?? "documents";
    const { data: signed, error: signError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.file_path, 3600);

    if (signError || !signed?.signedUrl) {
      if (sourceDocumentUrl) {
        return NextResponse.json({ url: sourceDocumentUrl });
      }

      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "knowledge/signed-url#GET",
        message: "Failed to generate document URL and no source URL is available.",
        cause: signError?.message,
      });
    }

    return NextResponse.json({ url: signed.signedUrl });
  },
);
