import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { fetchWithPolicy } from "@/lib/guardrails/dependency";

import { getBackendAdminApiKey, requireAdmin } from "../_shared";

const Schema = z.object({
  batchSize: z.number().int().min(1).max(5000).default(500),
  dryRun: z.boolean().default(false),
  useContentInference: z.boolean().default(false),
});

function getBackendUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.PYTHON_BACKEND_URL ||
    (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "")
  )
    .replace(/\/+$/, "")
    .trim();
}

export const POST = withApiGuardrails(
  "api.admin.source-sync.onedrive-project-backfill.POST",
  async ({ request, requestId }) => {
    await requireAdmin("api.admin.source-sync.onedrive-project-backfill.POST");

    const body = await parseJsonBody(
      request,
      Schema,
      "api.admin.source-sync.onedrive-project-backfill.POST",
    );

    const apiKey = getBackendAdminApiKey();
    const url = `${getBackendUrl()}/api/admin/documents/onedrive-project-backfill`;

    const backendResponse = await fetchWithPolicy(
      requestId,
      "api.admin.source-sync.onedrive-project-backfill.POST",
      "backend.admin.onedrive-project-backfill",
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Api-Key": apiKey,
        },
        body: JSON.stringify({
          batch_size: body.batchSize,
          dry_run: body.dryRun,
          use_content_inference: body.useContentInference,
        }),
        cache: "no-store",
      },
      { timeoutMs: 120_000, maxRetries: 0, backoffMs: 0 },
    );

    return NextResponse.json(await backendResponse.json());
  },
);
