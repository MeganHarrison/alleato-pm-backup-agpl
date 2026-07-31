import { after, NextResponse } from "next/server";
import { requireCurrentUserExecutiveDetail } from "@/lib/executive/executive-visibility";
import { flushLangfuse } from "@/instrumentation";
import {
  currentExecutiveDailyBriefTraceId,
  updateExecutiveDailyBriefObservation,
  withExecutiveDailyBriefObservation,
  withExecutiveDailyBriefTrace,
} from "@/lib/ai/executive-daily-brief-langfuse";
import {
  loadCurrentDailyExecutiveBriefPacket,
  toCanonicalDailyBriefApiResponse,
} from "@/lib/daily-briefs/canonical-packets";

function scheduleLangfuseFlush() {
  try {
    after(() => flushLangfuse());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("outside a request scope")) {
      throw error;
    }
    void flushLangfuse();
  }
}

export async function getDailyBriefPacketResponse(
  request: Request,
  guardrailKey: string,
) {
  scheduleLangfuseFlush();

  return withExecutiveDailyBriefTrace(
    {
      name: "executive-daily-brief.packet",
      sessionId: `executive-daily-brief:${new Date().toISOString().slice(0, 10)}`,
      triggerType: "packet_endpoint",
      metadata: {
        route: guardrailKey,
      },
      input: {
        method: request.method,
        url: request.url,
      },
    },
    async () => {
      await requireCurrentUserExecutiveDetail(guardrailKey);

      const { searchParams } = new URL(request.url);
      const fresh = searchParams.get("fresh") === "true";

      if (fresh) {
        return NextResponse.json(
          {
            error: "legacy_generation_retired",
            message:
              "Daily Brief fresh generation from this endpoint is retired. Run the canonical manual source-bundle compiler so the output writes to intelligence_packets/daily-executive-brief.",
            sourceOfTruth: "intelligence_packets",
          },
          { status: 409 },
        );
      }

      const packet = await withExecutiveDailyBriefObservation(
        "daily-brief.read-current-canonical-packet",
        {
          type: "retriever",
          metadata: {
            route: guardrailKey,
            sourceOfTruth: "intelligence_packets",
          },
          input: { targetSlug: "daily-executive-brief" },
        },
        async () => {
          const current = await loadCurrentDailyExecutiveBriefPacket();
          updateExecutiveDailyBriefObservation({
            output: {
              ok: true,
              packetId: current.id,
              sourceCount: current.sourceCount,
            },
          });
          return current;
        },
      );

      updateExecutiveDailyBriefObservation({
        metadata: {
          route: guardrailKey,
          fresh,
          sourceOfTruth: "intelligence_packets",
          packetId: packet.id,
          sourceCount: packet.sourceCount,
          traceId: currentExecutiveDailyBriefTraceId(),
        },
        output: {
          ok: true,
          packetId: packet.id,
        },
      });

      return NextResponse.json(toCanonicalDailyBriefApiResponse(packet));
    },
  );
}
