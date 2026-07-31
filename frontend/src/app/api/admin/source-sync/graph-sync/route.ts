import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

import { fetchBackendSourceSync, requireAdmin } from "../_shared";

const GraphSyncRequestSchema = z.object({
  runOutlook: z.boolean().default(true),
  runTeams: z.boolean().default(true),
  runOneDrive: z.boolean().default(false),
  runEmbedding: z.boolean().default(false),
  runTeamsCompiler: z.boolean().default(false),
  embedLimit: z.number().int().min(1).max(25).default(25),
  teamsCompilerBatchSize: z.number().int().min(1).max(100).default(10),
});

export const POST = withApiGuardrails(
  "api.admin.source-sync.graph-sync.POST",
  async ({ request, requestId }) => {
    await requireAdmin("api.admin.source-sync.graph-sync.POST");
    const body = await parseJsonBody(
      request,
      GraphSyncRequestSchema,
      "api.admin.source-sync.graph-sync.POST",
    );
    try {
      const backendResponse = await fetchBackendSourceSync(
        requestId,
        "api.admin.source-sync.graph-sync.POST",
        "graph-sync",
        {
          method: "POST",
          body: JSON.stringify({
            run_outlook: body.runOutlook,
            run_teams: body.runTeams,
            run_onedrive: body.runOneDrive,
            run_embedding: body.runEmbedding,
            embed_limit: body.embedLimit,
          }),
        },
        undefined,
        {
          timeoutMs: 15_000,
          maxRetries: 0,
        },
      );

      return NextResponse.json({
        status: "complete",
        result: await backendResponse.json(),
      });
    } catch (error) {
      if (error instanceof GuardrailError && error.code === "UPSTREAM_TIMEOUT") {
        return NextResponse.json(
          {
            status: "accepted",
            message:
              "Graph sync was started but did not return within the dashboard start window. Refresh source-sync status instead of waiting on this control.",
            nextStep: "Refresh /source-sync in 1-2 minutes, or use the scheduled worker for full sync drains.",
            timeoutMs: 15_000,
            requested: {
              runOutlook: body.runOutlook,
              runTeams: body.runTeams,
              runOneDrive: body.runOneDrive,
              runEmbedding: body.runEmbedding,
              embedLimit: body.embedLimit,
            },
          },
          { status: 202 },
        );
      }
      throw error;
    }
  },
);
