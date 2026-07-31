import { tool } from "ai";
import { z } from "zod";
import {
  loadCurrentDailyExecutiveBriefPacket,
  toCanonicalDailyBriefApiResponse,
} from "@/lib/daily-briefs/canonical-packets";
import { type ToolTracePayload, withTrace as _withTrace } from "./tool-utils";

type CreateExecutiveBriefToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateExecutiveBriefToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "Daily Executive Brief read failed. Check whether the canonical intelligence_packets/daily-executive-brief packet exists and is fresh.",
  );
}

export function createExecutiveBriefTools(
  options: CreateExecutiveBriefToolsOptions = {},
) {
  return {
    readCurrentDailyExecutiveBrief: tool({
      description:
        "Read the current canonical Daily Executive Brief from intelligence_packets target slug daily-executive-brief. Use this when the user asks for today's brief, the current executive brief, or the saved daily update. Do not regenerate the brief; if the packet is missing or stale, report that the canonical packet must be compiled first.",
      inputSchema: z.object({}),
      execute: withTrace(
        "readCurrentDailyExecutiveBrief",
        options,
        async () => {
          const packet = await loadCurrentDailyExecutiveBriefPacket();
          return toCanonicalDailyBriefApiResponse(packet);
        },
      ),
    }),
  };
}
