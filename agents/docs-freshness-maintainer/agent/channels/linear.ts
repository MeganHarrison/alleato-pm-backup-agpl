import { linearChannel } from "eve/channels/linear";

import {
  logLinearDeliveryEvent,
  truncateActivityBody,
} from "../lib/linear-delivery-log.js";

export default linearChannel({
  credentials: {
    accessToken: () =>
      requiredEnv(
        "LINEAR_AGENT_ACCESS_TOKEN",
        process.env.LINEAR_AGENT_ACCESS_TOKEN ??
          process.env.LINEAR_ACCESS_TOKEN,
      ),
    webhookSecret: () =>
      requiredEnv(
        "LINEAR_WEBHOOK_SECRET",
        process.env.LINEAR_WEBHOOK_SECRET,
      ),
  },
  events: {
    async "message.completed"(eventData, channel) {
      if (eventData.finishReason === "tool-calls" || !eventData.message) return;

      const activity = await channel.linear.createActivity({
        body: eventData.message,
        type: "response",
      });
      if (!activity.success) {
        throw new Error(
          "Docs freshness Linear delivery failed: final response activity was not accepted.",
        );
      }
      const recent = await channel.linear.listActivities({ last: 3 });
      if (!recent.some((candidate) => candidate.id === activity.id)) {
        throw new Error(
          "Docs freshness Linear delivery failed read-back: created activity was not returned by Linear.",
        );
      }

      logLinearDeliveryEvent("final-response-delivered", {
        activityId: activity.id,
        agentSessionId: channel.linear.agentSessionId,
        bodyPreview: truncateActivityBody(eventData.message),
      });
    },
    async "turn.failed"(eventData, channel) {
      logLinearDeliveryEvent("turn-failed", {
        agentSessionId: channel.linear.agentSessionId,
        error: truncateActivityBody(eventData.message),
      });
    },
    async "session.failed"(eventData, channel) {
      logLinearDeliveryEvent("session-failed", {
        agentSessionId: channel.linear.agentSessionId,
        error: truncateActivityBody(eventData.message),
      });
    },
  },
});

function requiredEnv(name: string, value: string | undefined): string {
  if (value) return value;
  throw new Error(`Docs freshness Linear delivery blocked: missing ${name}.`);
}
