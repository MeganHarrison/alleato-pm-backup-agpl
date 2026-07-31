import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { promoteDailyDeepReadCandidate } from "@/lib/daily-briefs/daily-deep-read-promotion";
import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";

function parseProjectId(value: string, where: string): number {
  const projectId = Number(value);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where,
      message: "Project id must be a positive integer.",
      status: 400,
      details: { projectId: value },
    });
  }
  return projectId;
}

// Returns (rather than throws) the GuardrailError so callers can write
// `throw await buildAuthGuardrailError(...)` — a real `throw` statement,
// which TS's control-flow analysis narrows correctly afterward. Awaiting a
// Promise<never>-returning function as a bare statement does not reliably
// mark the following code unreachable.
async function buildAuthGuardrailError(
  response: NextResponse,
  where: string,
): Promise<GuardrailError> {
  const payload = await response.json().catch(() => null);
  const message =
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
      ? payload.error
      : "Project access denied.";

  return new GuardrailError({
    code: response.status === 401 ? "UNAUTHORIZED" : "AUTH_FORBIDDEN",
    where,
    message,
    status: response.status,
  });
}

export const POST = withApiGuardrails<{
  projectId: string;
  candidateId: string;
}>(
  "projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/promote#POST",
  async ({ params }) => {
    const where =
      "projects/[projectId]/intelligence/daily-deep-read-candidates/[candidateId]/promote#POST";
    const { projectId, candidateId } = await params;
    const numericProjectId = parseProjectId(projectId, where);
    const auth = await verifyProjectAccess(numericProjectId);
    if (isAuthError(auth)) throw await buildAuthGuardrailError(auth, where);

    const result = await promoteDailyDeepReadCandidate({
      candidateId,
      projectId: numericProjectId,
      reviewedBy: auth.membership.authUserId,
    });

    return NextResponse.json(result);
  },
);
