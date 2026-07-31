import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_shared";
import { getCodexControlPlaneData } from "@/lib/codex-command-center/control-plane";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withApiGuardrails("command-center/ops#GET", async () => {
  await requireAdmin("command-center/ops#GET");

  const data = await getCodexControlPlaneData();

  if (data.sessions.length === 0 && data.reviewQueue.length === 0) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "command-center/ops#GET",
      message:
        "Codex orchestration control-plane files are missing or empty. Restore docs/ops/orchestration before using the command center.",
      status: 404,
      details: data.issues,
    });
  }

  return NextResponse.json(data);
});
