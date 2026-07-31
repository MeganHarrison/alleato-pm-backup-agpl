import { NextRequest, NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { withApiGuardrails } from "@/lib/guardrails/api";
import {
  loadDashboardVisualizations,
  loadVisualizationDetail,
} from "@/lib/ai-dashboard/dashboard-visualizations.server";
import type {
  ActivityRange,
  VisualizationDetailKind,
} from "@/lib/ai-dashboard/dashboard-visualization-contract";

const ACTIVITY_RANGES = new Set<ActivityRange>(["today", "24h", "7d", "30d"]);
const DETAIL_KINDS = new Set<VisualizationDetailKind>([
  "lifecycle",
  "activity",
  "opportunity",
]);

export const GET = withApiGuardrails(
  "api.ai-dashboard.visualizations.GET",
  async ({ request }: { request: NextRequest }) => {
    await requireCurrentUserExecutiveDetail(
      "api.ai-dashboard.visualizations.GET",
    );

    const search = request.nextUrl.searchParams;
    const rawRange = search.get("range") as ActivityRange | null;
    const range = rawRange && ACTIVITY_RANGES.has(rawRange) ? rawRange : "7d";
    const rawProjectId = search.get("projectId");
    const parsedProjectId = rawProjectId ? Number(rawProjectId) : null;
    const projectId = Number.isInteger(parsedProjectId) ? parsedProjectId : null;
    const rawDetail = search.get("detail") as VisualizationDetailKind | null;
    const key = search.get("key");

    if (rawDetail || key) {
      if (!rawDetail || !DETAIL_KINDS.has(rawDetail) || !key) {
        return NextResponse.json(
          {
            error:
              "Visualization detail requires a supported detail kind and key.",
          },
          { status: 400 },
        );
      }

      return NextResponse.json(
        await loadVisualizationDetail({
          kind: rawDetail,
          key,
          range,
          projectId,
        }),
      );
    }

    return NextResponse.json(
      await loadDashboardVisualizations(range, projectId),
    );
  },
);
