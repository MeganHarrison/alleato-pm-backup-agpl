import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { loadExecutiveClaimLineage } from "@/lib/executive/executive-claim-lineage";
import { GuardrailError } from "@/lib/guardrails/errors";
import { withApiGuardrails } from "@/lib/guardrails/api";

const uuid = z.string().uuid();

export const GET = withApiGuardrails<{ claimId: string }>(
  "api.executive.claims.[claimId].lineage.GET",
  async ({ request, params }) => {
    await requireCurrentUserExecutiveDetail("api.executive.claims.[claimId].lineage.GET");
    const { claimId } = await params;
    if (!uuid.safeParse(claimId).success) throw new GuardrailError({ code: "BAD_REQUEST", where: "api.executive.claims.[claimId].lineage.GET", status: 400, message: "A valid executive claim id is required." });
    const briefId = new URL(request.url).searchParams.get("briefId");
    if (!briefId || !uuid.safeParse(briefId).success) throw new GuardrailError({ code: "BAD_REQUEST", where: "api.executive.claims.[claimId].lineage.GET", status: 400, message: "A valid Daily Brief id is required to explain a claim." });
    const lineage = await loadExecutiveClaimLineage(briefId, claimId);
    if (lineage.state === "lineage_unavailable") {
      return NextResponse.json({ error: lineage.message, details: lineage }, { status: 409 });
    }
    return NextResponse.json(lineage);
  },
);
