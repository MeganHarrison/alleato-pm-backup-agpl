import { NextResponse } from "next/server";
import { z } from "zod";

import { validateResponseContract, withApiGuardrails } from "@/lib/guardrails/api";

import { fetchBackendSourceSync, requireAdmin } from "../_shared";

const RecomputeResponseSchema = z.object({
  status: z.string(),
  updatedSnapshots: z.number(),
  health: z.unknown(),
});

export const POST = withApiGuardrails(
  "api.admin.source-sync.recompute.POST",
  async ({ requestId }) => {
    await requireAdmin("api.admin.source-sync.recompute.POST");
    const backendResponse = await fetchBackendSourceSync(
      requestId,
      "api.admin.source-sync.recompute.POST",
      "recompute",
      { method: "POST" },
    );
    const payload = await backendResponse.json();
    const result = validateResponseContract(
      RecomputeResponseSchema,
      payload,
      "api.admin.source-sync.recompute.POST",
    );

    return NextResponse.json(result);
  },
);
