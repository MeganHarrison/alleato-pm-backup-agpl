import { listLinearAgentSessionActivities } from "eve/channels/linear";
import { defineSchedule } from "eve/schedules";

import linear from "../channels/linear.js";
import {
  logLinearDeliveryEvent,
  readLinearAgentSessionIdFromContinuationToken,
} from "../lib/linear-delivery-log.js";

const maintainerMessage = [
  "Run the Docs Freshness Maintainer weekday scan.",
  "Call summarize_doc_findings with includeHealthy=false.",
  "Report every warn, fail, or blocked finding with cause, detection gap, prevention, owner files, and exact next action.",
  "If every tracked artifact passes, send one compact PASS heartbeat.",
  "Do not call regenerate_generated_docs and do not mutate repository files. Regeneration requires explicit human approval.",
].join("\n");

export default defineSchedule({
  cron: "30 12 * * 1-5",
  async run({ receive, appAuth }) {
    const targetIssueId = requiredEnv(
      "EVE_DOCS_MAINTAINER_LINEAR_ISSUE_ID",
      process.env.EVE_DOCS_MAINTAINER_LINEAR_ISSUE_ID,
    );
    requiredEnv(
      "LINEAR_AGENT_ACCESS_TOKEN",
      process.env.LINEAR_AGENT_ACCESS_TOKEN ??
        process.env.LINEAR_ACCESS_TOKEN,
    );
    requiredEnv("LINEAR_WEBHOOK_SECRET", process.env.LINEAR_WEBHOOK_SECRET);

    const session = await receive(linear, {
      auth: appAuth,
      message: maintainerMessage,
      target: {
        issueId: targetIssueId,
        initialActivity: "Running Docs Freshness Maintainer scan.",
      },
    });
    const agentSessionId =
      readLinearAgentSessionIdFromContinuationToken(
        session.continuationToken,
      );
    if (!agentSessionId) {
      throw new Error(
        "Docs freshness Linear delivery failed: Eve did not return a Linear Agent Session continuation token.",
      );
    }

    logLinearDeliveryEvent("proactive-session-created", {
      agentSessionId,
      eveSessionId: session.id,
      issueId: targetIssueId,
    });

    const outcome = await readSessionOutcome(session);
    if (!outcome.terminalEvent) {
      throw new Error(
        "Docs freshness Linear delivery failed: Eve event stream ended without a terminal session event.",
      );
    }
    if (outcome.failure) {
      throw new Error(
        `Docs freshness Linear delivery failed in ${outcome.terminalEvent}: ${outcome.failure}`,
      );
    }
    if (!outcome.finalMessage) {
      throw new Error(
        `Docs freshness Linear delivery failed: ${outcome.terminalEvent} had no final report message.`,
      );
    }

    const activities = await listLinearAgentSessionActivities({
      agentSessionId,
      last: 5,
    });
    const delivered = activities.some((activity) => {
      const body = activity.content.body;
      return (
        typeof body === "string" &&
        body.includes(outcome.finalMessage!.slice(0, 80))
      );
    });
    if (!delivered) {
      throw new Error(
        "Docs freshness Linear delivery failed read-back: the final report was not present in recent Agent Session activities.",
      );
    }

    logLinearDeliveryEvent("linear-activity-readback", {
      activityIds: activities.map((activity) => activity.id),
      agentSessionId,
      terminalEvent: outcome.terminalEvent,
    });
  },
});

async function readSessionOutcome(session: {
  getEventStream(options?: {
    startIndex?: number;
  }): Promise<ReadableStream<unknown>>;
}) {
  const reader = (await session.getEventStream()).getReader();
  let failure: string | null = null;
  let finalMessage: string | null = null;
  let terminalEvent: string | null = null;

  while (true) {
    const next = await reader.read();
    if (next.done) break;
    const event = next.value;
    if (!isEventRecord(event)) continue;

    if (event.type === "message.completed" && isRecord(event.data)) {
      const message =
        typeof event.data.message === "string" ? event.data.message : null;
      const finishReason =
        typeof event.data.finishReason === "string"
          ? event.data.finishReason
          : null;
      if (message && finishReason !== "tool-calls") finalMessage = message;
      continue;
    }

    if (event.type === "turn.failed" || event.type === "session.failed") {
      failure =
        isRecord(event.data) && typeof event.data.message === "string"
          ? event.data.message
          : "Eve reported a failure without a message.";
      terminalEvent = event.type;
      break;
    }
    if (
      event.type === "session.completed" ||
      event.type === "session.waiting"
    ) {
      terminalEvent = event.type;
      break;
    }
  }

  return { failure, finalMessage, terminalEvent };
}

function requiredEnv(name: string, value: string | undefined): string {
  if (value) return value;
  throw new Error(`Docs freshness Linear delivery blocked: missing ${name}.`);
}

function isEventRecord(
  value: unknown,
): value is { type: string; data?: unknown } {
  return isRecord(value) && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
