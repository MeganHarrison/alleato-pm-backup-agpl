import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { fetchWithGuardrails, WRITE_POLICY } from "@/lib/fetch-with-guardrails";
import { getGraphToken } from "@/lib/microsoft-graph/calendar-invites";

export const dynamic = "force-dynamic";

const WHERE = "files/[docId]/office-preview#GET";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type DocRow = {
  id: string;
  source_system: string | null;
  source_drive_id: string | null;
  source_item_id: string | null;
  source_metadata: Record<string, unknown> | null;
};

/**
 * Resolves drive/item ids for a Graph document.
 *
 * Primary path: `source_drive_id` + `source_item_id` columns (populated by the
 * OneDrive/SharePoint sync for drive items).
 *
 * Fallback: inspect `source_metadata` jsonb for the same ids stored under
 * multiple key conventions (`drive_id`/`driveId`, `item_id`/`itemId`).
 * This mirrors how the download route reads `source_metadata` for Outlook items.
 */
function resolveGraphIds(
  doc: DocRow,
): { driveId: string; itemId: string } | null {
  // Primary: dedicated columns
  if (doc.source_drive_id && doc.source_item_id) {
    return { driveId: doc.source_drive_id, itemId: doc.source_item_id };
  }

  // Fallback: source_metadata jsonb — key names vary by ingestion path
  const meta = doc.source_metadata ?? {};
  const driveId =
    typeof meta.drive_id === "string"
      ? meta.drive_id
      : typeof meta.driveId === "string"
        ? meta.driveId
        : null;
  const itemId =
    typeof meta.item_id === "string"
      ? meta.item_id
      : typeof meta.itemId === "string"
        ? meta.itemId
        : null;

  if (driveId && itemId) {
    return { driveId, itemId };
  }

  return null;
}

export const GET = withApiGuardrails<{ docId: string }>(
  WHERE,
  async ({ params, requestId }) => {
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: WHERE,
        message: "Authentication required.",
      });
    }

    const { docId } = await params;
    const supabase = createServiceClient();

    const { data: doc, error } = await serviceDb.from("document_metadata")
      .select(
        "id, source_system, source_drive_id, source_item_id, source_metadata",
      )
      .eq("id", docId)
      .maybeSingle<DocRow>();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: WHERE,
        message: "Could not load the requested document.",
        cause: error,
      });
    }

    if (!doc) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Document not found.",
        status: 404,
      });
    }

    // Only OneDrive/SharePoint items sourced via Microsoft Graph support Office preview.
    if (doc.source_system !== "microsoft_graph") {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "No Office preview available for this document type.",
        status: 404,
      });
    }

    const ids = resolveGraphIds(doc);
    if (!ids) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message:
          "No Office preview available — document is missing drive/item identifiers.",
        status: 404,
      });
    }

    const token = await getGraphToken();

    // Graph POST /drives/{driveId}/items/{itemId}/preview returns { getUrl, postUrl, postParameters }
    // We use getUrl (safe embeddable URL). This is a non-idempotent call so use WRITE_POLICY (no retries).
    const graphUrl = `${GRAPH_BASE}/drives/${encodeURIComponent(ids.driveId)}/items/${encodeURIComponent(ids.itemId)}/preview`;

    const res = await fetchWithGuardrails(graphUrl, {
      ...WRITE_POLICY,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      requestId,
      where: WHERE,
      dependency: "microsoft-graph",
    });

    if (!res.ok) {
      throw new GuardrailError({
        code: "UPSTREAM_ERROR",
        where: WHERE,
        message: `Graph preview request failed (${res.status}).`,
        status: 502,
      });
    }

    const json = (await res.json()) as { getUrl?: string };

    if (!json.getUrl) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: WHERE,
        message: "Graph did not return a preview URL for this document.",
        status: 404,
      });
    }

    return NextResponse.json({ url: `${json.getUrl}&nb=true` });
  },
);
