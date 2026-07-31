import { NextResponse } from "next/server";

import { getFmdsFigureEvidenceUrl } from "@/lib/fmds/fmds-figures.server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const GET = withApiGuardrails<{ figureId: string }>(
  "fmds/figures/[figureId]/evidence#GET",
  async ({ params }) => {
    const { figureId } = params;
    const evidenceUrl = await getFmdsFigureEvidenceUrl(figureId);
    if (!evidenceUrl) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "fmds/figures/[figureId]/evidence#GET",
        message: "FMDS0834 figure evidence not found.",
        status: 404,
      });
    }

    return NextResponse.redirect(evidenceUrl);
  },
);
