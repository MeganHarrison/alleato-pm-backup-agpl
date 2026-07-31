import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { loadExecutivePortfolioState } from "@/lib/executive/executive-portfolio-state";
import { loadGovernedExecutiveArtifact } from "@/lib/executive/governed-executive-artifact";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails(
  "api.executive.portfolio-state.GET",
  async () => {
    await requireCurrentUserExecutiveDetail("api.executive.portfolio-state.GET");
    const artifact = await loadGovernedExecutiveArtifact("weekly");
    return NextResponse.json(await loadExecutivePortfolioState({ state: artifact.state, executive: artifact.executive, governedArtifactVersionId: artifact.id }));
  },
);
