import { NextResponse } from "next/server";
import { z } from "zod";

import {
  parseJsonBody,
  validateResponseContract,
  withApiGuardrails,
} from "@/lib/guardrails/api";

import { fetchBackendSourceSync, requireAdmin } from "../_shared";

const GraphEmbedRequestSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
});

const GraphEmbedResponseSchema = z.object({
  embedded: z.number(),
  total_chunks: z.number().optional(),
  errors: z.number(),
  by_category: z.record(z.string(), z.number()).optional(),
});

export const POST = withApiGuardrails(
  "api.admin.source-sync.graph-embed.POST",
  async ({ request, requestId }) => {
    await requireAdmin("api.admin.source-sync.graph-embed.POST");
    const body = await parseJsonBody(
      request,
      GraphEmbedRequestSchema,
      "api.admin.source-sync.graph-embed.POST",
    );
    const backendResponse = await fetchBackendSourceSync(
      requestId,
      "api.admin.source-sync.graph-embed.POST",
      "graph-embed",
      { method: "POST" },
      { limit: body.limit },
    );
    const payload = await backendResponse.json();
    const result = validateResponseContract(
      GraphEmbedResponseSchema,
      payload,
      "api.admin.source-sync.graph-embed.POST",
    );

    return NextResponse.json({ ...result, requestedLimit: body.limit });
  },
);
