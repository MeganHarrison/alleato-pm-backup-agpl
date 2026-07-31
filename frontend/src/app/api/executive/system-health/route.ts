import { NextResponse } from "next/server";

import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { loadExecutiveSystemHealth } from "@/lib/executive/executive-system-health";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const GET = withApiGuardrails(
  "api.executive.system-health.GET",
  async () => {
    await requireCurrentUserExecutiveDetail("api.executive.system-health.GET");
    return NextResponse.json(await loadExecutiveSystemHealth());
  },
);
