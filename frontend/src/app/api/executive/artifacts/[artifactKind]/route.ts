import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { loadGovernedExecutiveArtifact, type ExecutiveArtifactKind } from "@/lib/executive/governed-executive-artifact";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

function artifactKind(value: string): ExecutiveArtifactKind {
  if (value === "daily" || value === "weekly" || value === "monthly") return value;
  throw new GuardrailError({ code: "NOT_FOUND", where: "api.executive.artifacts.GET", status: 404, message: "Executive artifact kind not found." });
}

export const GET = withApiGuardrails<{ artifactKind: string }>(
  "api.executive.artifacts.[artifactKind].GET",
  async ({ params }) => {
    await requireCurrentUserExecutiveDetail("api.executive.artifacts.GET");
    const { artifactKind: rawKind } = await params;
    const artifact = await loadGovernedExecutiveArtifact(artifactKind(rawKind));
    return NextResponse.json(artifact);
  },
);
