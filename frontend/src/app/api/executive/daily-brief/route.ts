import { withApiGuardrails } from "@/lib/guardrails/api";
import { getDailyBriefPacketResponse } from "./route-helpers";

export const GET = withApiGuardrails(
  "/api/executive/daily-brief#GET",
  async ({ request }) =>
    getDailyBriefPacketResponse(request, "/api/executive/daily-brief#GET"),
);
