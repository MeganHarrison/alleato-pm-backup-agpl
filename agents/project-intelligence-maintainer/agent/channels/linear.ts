import { linearChannel } from "eve/channels/linear";

import { logLinearDeliveryEvent, truncateActivityBody } from "../lib/linear-delivery-log.js";

export default linearChannel({
  credentials: {
    accessToken: () =>
      requiredEnv(
        "LINEAR_AGENT_ACCESS_TOKEN",
        process.env.LINEAR_AGENT_ACCESS_TOKEN ?? process.env.LINEAR_ACCESS_TOKEN,
      ),
    webhookSecret: () => requiredEnv("LINEAR_WEBHOOK_SECRET", process.env.LINEAR_WEBHOOK_SECRET),
  },
  events: {
    async "message.completed"(eventData, channel) {
      if (eventData.finishReason === "tool-calls" || !eventData.message) return;

      const createdActivity = await channel.linear.createActivity({
        body: eventData.message,
        type: "response",
      });
      const recentActivities = await channel.linear.listActivities({ last: 3 });

      logLinearDeliveryEvent("final-response-delivered", {
        activityId: createdActivity.id,
        activitySuccess: createdActivity.success,
        agentSessionId: channel.linear.agentSessionId,
        bodyPreview: truncateActivityBody(eventData.message),
        recentActivityIds: recentActivities.map((activity) => activity.id),
        recentActivityTypes: recentActivities.map((activity) => activity.content.type ?? activity.content.__typename ?? null),
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
  throw new Error(`Linear channel delivery blocked: missing ${name}.`);
}
