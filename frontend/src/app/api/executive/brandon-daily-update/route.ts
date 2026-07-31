import { withApiGuardrails } from "@/lib/guardrails/api";
import { getDailyBriefPacketResponse } from "../daily-brief/route-helpers";

export const GET = withApiGuardrails(
  "/api/executive/brandon-daily-update#GET",
  async ({ request }) =>
    getDailyBriefPacketResponse(
      request,
      "/api/executive/brandon-daily-update#GET",
    ),
);
