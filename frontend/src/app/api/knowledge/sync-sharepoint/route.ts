export const dynamic = "force-dynamic";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KNOWLEDGE_BASE_SHARE_URL =
  "https://alleato.sharepoint.com/:f:/s/AlleatoGroup/IgCo1HwDu98GSKEiKN1hGQ3ZASL22yaZpbU24gDbsuTfA5U?e=7fPOkY";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const TEXT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".csv",
]);

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function getGraphToken(): Promise<string> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID;

  const missing = (
    [
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_TENANT_ID",
    ] as const
  ).filter((k) => !process.env[k]);

  if (missing.length > 0) {
    throw new Error(`Missing Microsoft Graph env vars: ${missing.join(", ")}`);
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId!,
    client_secret: clientSecret!,
    scope: "https://graph.microsoft.com/.default",
  });

  return fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
  )
    .then((r) => r.json())
    .then((d) => d.access_token as string);
}

function shareIdFromUrl(url: string): string {
  const encoded = Buffer.from(url).toString("base64url");
  return `u!${encoded}`;
}

async function graphGet(
  pathOrUrl: string,
  token: string,
): Promise<Record<string, unknown>> {
  const url = pathOrUrl.startsWith("https://")
    ? pathOrUrl
    : `${GRAPH_BASE}${pathOrUrl}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok)
    throw new Error(`Graph GET ${url} → ${res.status} ${res.statusText}`);
  return res.json();
}

interface GraphItem {
  id: string;
  name: string;
  size?: number;
  folder?: unknown;
  lastModifiedDateTime?: string;
  webUrl?: string;
  eTag?: string;
  cTag?: string;
}

async function walkFolder(
  driveId: string,
  itemId: string,
  token: string,
  pathParts: string[],
  out: Array<{ pathParts: string[]; item: GraphItem }>,
): Promise<void> {
  let url: string | null =
    `${GRAPH_BASE}/drives/${driveId}/items/${itemId}/children` +
    `?$select=id,name,size,folder,file,lastModifiedDateTime,webUrl,eTag,cTag`;

  while (url) {
    const data = (await graphGet(url, token)) as {
      value?: GraphItem[];
      "@odata.nextLink"?: string;
    };
    for (const child of data.value ?? []) {
      if (child.folder) {
        await walkFolder(
          driveId,
          child.id,
          token,
          [...pathParts, child.name],
          out,
        );
      } else {
        out.push({ pathParts, item: child });
      }
    }
    url = data["@odata.nextLink"] ?? null;
  }
}

// ---------------------------------------------------------------------------
// Metadata row builder
// ---------------------------------------------------------------------------

function metadataId(driveId: string, itemId: string): string {
  // Deterministic UUID v5 equivalent using a simple hash (no crypto deps needed)
  // We use the same scheme as the Python script: uuid5(NAMESPACE_URL, "microsoft_graph:{driveId}:{itemId}")
  // Node has crypto built-in:
  const { createHash } = require("crypto") as typeof import("crypto");
  const namespace = "6ba7b811-9dad-11d1-80b4-00c04fd430c8"; // UUID namespace URL bytes
  const nsBytes = namespace
    .replace(/-/g, "")
    .match(/../g)!
    .map((h) => parseInt(h, 16));
  const name = `microsoft_graph:${driveId}:${itemId}`;
  const nameBytes = Buffer.from(name, "utf-8");
  const hash = createHash("sha1")
    .update(Buffer.from(nsBytes))
    .update(nameBytes)
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function toTitleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function buildRow(
  pathParts: string[],
  item: GraphItem,
  driveId: string,
  siteId: string | null,
): Record<string, unknown> {
  const ext = item.name.includes(".")
    ? `.${item.name.split(".").pop()!.toLowerCase()}`
    : "";
  const sourcePath = [...pathParts, item.name].join(" / ");
  const storageKey = `knowledge-base/${item.id}${ext}`;
  const category = pathParts[0] ? toTitleCase(pathParts[0]) : "General";

  return {
    id: metadataId(driveId, item.id),
    title: item.name.replace(/\.[^.]+$/, ""),
    file_name: item.name,
    file_path: storageKey,
    url: item.webUrl ?? null,
    type: "knowledge-base",
    category,
    source: "microsoft_graph",
    source_system: "microsoft_graph",
    source_drive_id: driveId,
    source_item_id: item.id,
    source_site_id: siteId,
    source_path: sourcePath,
    source_web_url: item.webUrl ?? null,
    source_etag: item.eTag ?? item.cTag ?? null,
    source_last_modified_at: item.lastModifiedDateTime ?? null,
    source_size: item.size ?? null,
    date: item.lastModifiedDateTime ?? null,
    status: "raw_ingested",
    phase: "ingest",
    storage_bucket: "documents",
    workflow_target: "knowledge",
    tags: "knowledge-base,sharepoint",
    source_metadata: {
      source_folder: pathParts,
      storage_candidate_path: storageKey,
    },
  };
}

// ---------------------------------------------------------------------------
// POST /api/knowledge/sync-sharepoint
// ---------------------------------------------------------------------------

export const POST = withApiGuardrails(
  "knowledge/sync-sharepoint#POST",
  async ({ request }) => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "knowledge/sync-sharepoint#POST",
        message: "Authentication required.",
      });
    }

    // Admin only
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_admin !== true) {
      throw new GuardrailError({
        code: "AUTH_FORBIDDEN",
        where: "knowledge/sync-sharepoint#POST",
        message: "Admin access is required to sync SharePoint sources.",
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      shareUrl?: string;
    };
    const shareUrl = body.shareUrl ?? KNOWLEDGE_BASE_SHARE_URL;

    logger.info({
      msg: "knowledge/sync-sharepoint: starting",
      data: { userId: user.id },
    });

    const token = await getGraphToken();
    const shareId = shareIdFromUrl(shareUrl);
    const root = (await graphGet(`/shares/${shareId}/driveItem`, token)) as {
      id: string;
      name?: string;
      parentReference?: { driveId?: string; siteId?: string };
    };

    const driveId = root.parentReference?.driveId;
    const siteId = root.parentReference?.siteId ?? null;

    if (!driveId) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "knowledge/sync-sharepoint#POST",
        message:
          "Could not resolve SharePoint drive. Check that the sharing link is still valid.",
      });
    }

    const allFiles: Array<{ pathParts: string[]; item: GraphItem }> = [];
    await walkFolder(driveId, root.id, token, [], allFiles);

    const eligible = allFiles.filter(({ item }) => {
      const ext = item.name.includes(".")
        ? `.${item.name.split(".").pop()!.toLowerCase()}`
        : "";
      return TEXT_EXTENSIONS.has(ext);
    });

    const rows = eligible.map(({ pathParts, item }) =>
      buildRow(pathParts, item, driveId, siteId),
    );

    // Upsert using service client (bypasses RLS)
    const serviceClient = createServiceClient();
    const ragWriteClient = createRagServiceClient();
    let upserted = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        await serviceDb.from("document_metadata").upsert(row as never);
        await ragWriteClient
          .from("fireflies_ingestion_jobs")
          .upsert(
            {
              fireflies_id: row.id,
              metadata_id: row.id,
              stage: "raw_ingested",
              error_message: null,
            } as never,
            { onConflict: "fireflies_id" },
          );
        upserted++;
      } catch (err) {
        logger.error({
          msg: "knowledge/sync-sharepoint: row upsert failed",
          data: { file: row.file_name, err },
        });
        errors++;
      }
    }

    logger.info({
      msg: "knowledge/sync-sharepoint: complete",
      data: {
        total: allFiles.length,
        eligible: eligible.length,
        upserted,
        errors,
      },
    });

    return NextResponse.json({
      ok: true,
      folderName: root.name ?? "SOP",
      total: allFiles.length,
      eligible: eligible.length,
      skipped: allFiles.length - eligible.length,
      upserted,
      errors,
    });
  },
);
