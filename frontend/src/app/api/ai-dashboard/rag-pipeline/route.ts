import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { withApiGuardrails } from "@/lib/guardrails/api";
import {
  loadRagPipelineSummary,
  type RagPipelineRange,
} from "@/lib/ai-dashboard/rag-pipeline.server";

const RANGES = new Set<RagPipelineRange>(["24h", "3d", "7d", "30d"]);

export const GET = withApiGuardrails(
  "api.ai-dashboard.rag-pipeline.GET",
  async ({ request }: { request: NextRequest }) => {
    await requireCurrentUserExecutiveDetail("api.ai-dashboard.rag-pipeline.GET");
    const requested = request.nextUrl.searchParams.get("range") as RagPipelineRange | null;
    const range = requested && RANGES.has(requested) ? requested : "7d";
    return NextResponse.json(await loadRagPipelineSummary(range));
  },
);
