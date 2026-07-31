import { defineSchedule } from "eve/schedules";
import { listLinearAgentSessionActivities } from "eve/channels/linear";

import linear from "../channels/linear.js";
import { logLinearDeliveryEvent, readLinearAgentSessionIdFromContinuationToken } from "../lib/linear-delivery-log.js";
import teams from "../channels/teams.js";

const targetIssueId = process.env.EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID;
const hasLinearAccessToken =
  Boolean(process.env.LINEAR_AGENT_ACCESS_TOKEN) || Boolean(process.env.LINEAR_ACCESS_TOKEN);
const hasLinearWebhookSecret = Boolean(process.env.LINEAR_WEBHOOK_SECRET);
const hasLegacyLinearApiKey = Boolean(process.env.LINEAR_API_KEY);
const teamsTarget = getTeamsTargetFromEnv();
const hasTeamsBotCredentials = Boolean(process.env.MICROSOFT_APP_ID) && Boolean(process.env.MICROSOFT_APP_PASSWORD);

const maintainerMessage = [
  "Run the Project Intelligence maintainer weekday scan.",
  "Report only non-healthy findings or a compact PASS heartbeat.",
  "Include source lifecycle status, packet freshness, read-back proof, cause, detection gap, prevention, owner path/table, and next action.",
  "Do not mutate data unless a bounded repair tool is explicitly approved by a human.",
].join("\n");

export default defineSchedule({
  cron: "0 13 * * 1-5",
  async run({ receive, waitUntil, appAuth }) {
    if (!targetIssueId || !hasLinearAccessToken || !hasLinearWebhookSecret) {
      console.error(
        [
          "Project Intelligence maintainer Linear delivery blocked.",
          "Required env: EVE_PROJECT_INTELLIGENCE_LINEAR_ISSUE_ID, LINEAR_AGENT_ACCESS_TOKEN, LINEAR_WEBHOOK_SECRET.",
          "Linear API keys are not valid for Agent Session delivery because Eve sends the token as a Bearer token.",
          `Configured: targetIssueId=${Boolean(targetIssueId)}, agentAccessToken=${hasLinearAccessToken}, webhookSecret=${hasLinearWebhookSecret}, legacyApiKey=${hasLegacyLinearApiKey}.`,
        ].join(" "),
      );
      return;
    }

    const session = await receive(linear, {
      auth: appAuth,
      message: maintainerMessage,
      target: {
        issueId: targetIssueId,
        initialActivity: "Running Project Intelligence maintainer scan.",
      },
    });
    const agentSessionId = readLinearAgentSessionIdFromContinuationToken(session.continuationToken);

    logLinearDeliveryEvent("proactive-session-created", {
      agentSessionId,
      continuationToken: session.continuationToken,
      eveSessionId: session.id,
      issueId: targetIssueId,
    });

    const sessionOutcome = await readSessionOutcome(session);

    logLinearDeliveryEvent("eve-session-readback", {
      agentSessionId,
      eveSessionId: session.id,
      finalFailure: sessionOutcome.failure,
      finalMessagePreview: sessionOutcome.finalMessage,
      finishReason: sessionOutcome.finishReason,
      terminalEvent: sessionOutcome.terminalEvent,
    });

    if (agentSessionId) {
      const activities = await listLinearAgentSessionActivities({
        agentSessionId,
        last: 5,
      });

      logLinearDeliveryEvent("linear-activity-readback", {
        activityBodies: activities.map((activity) => activity.content.body ?? null),
        activityIds: activities.map((activity) => activity.id),
        activityTypes: activities.map((activity) => activity.content.type ?? activity.content.__typename ?? null),
        agentSessionId,
      });
    }

    if (!teamsTarget || !hasTeamsBotCredentials) {
      console.error(
        [
          "Project Intelligence maintainer Teams delivery blocked.",
          "Required env: MICROSOFT_APP_ID, MICROSOFT_APP_PASSWORD, EVE_PROJECT_INTELLIGENCE_TEAMS_SERVICE_URL, EVE_PROJECT_INTELLIGENCE_TEAMS_CONVERSATION_ID.",
          `Configured: botCredentials=${hasTeamsBotCredentials}, serviceUrl=${Boolean(teamsTarget?.serviceUrl)}, conversationId=${Boolean(teamsTarget?.conversationId)}.`,
        ].join(" "),
      );
      return;
    }

    waitUntil(
      receive(teams, {
        auth: appAuth,
        message: maintainerMessage,
        target: {
          ...teamsTarget,
          initialMessage: "Running Project Intelligence maintainer scan.",
        },
      }),
    );
  },
});

function getTeamsTargetFromEnv() {
  const serviceUrl = process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_SERVICE_URL;
  const conversationId = process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_CONVERSATION_ID;

  if (!serviceUrl || !conversationId) return null;

  return {
    serviceUrl,
    conversationId,
    channelId: process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_CHANNEL_ID,
    conversationType: process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_CONVERSATION_TYPE,
    replyToActivityId: process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_REPLY_TO_ACTIVITY_ID,
    teamId: process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_TEAM_ID,
    tenantId: process.env.MICROSOFT_TENANT_ID ?? process.env.EVE_PROJECT_INTELLIGENCE_TEAMS_TENANT_ID,
  };
}

async function readSessionOutcome(session: {
  getEventStream(options?: { startIndex?: number }): Promise<ReadableStream<unknown>>;
}) {
  const stream = await session.getEventStream();
  const reader = stream.getReader();

  let failure: string | null = null;
  let finalMessage: string | null = null;
  let finishReason: string | null = null;
  let terminalEvent: string | null = null;

  while (true) {
    const next = await reader.read();
    if (next.done) break;

    const event = next.value;
    if (!isEventRecord(event)) continue;

    if (event.type === "message.completed") {
      const data = event.data;
      if (isRecord(data)) {
        const candidateMessage = typeof data.message === "string" ? data.message : null;
        const candidateFinishReason = typeof data.finishReason === "string" ? data.finishReason : null;

        if (candidateFinishReason !== "tool-calls" && candidateMessage) {
          finalMessage = candidateMessage;
          finishReason = candidateFinishReason;
        }
      }
      continue;
    }

    if (event.type === "turn.failed" || event.type === "session.failed") {
      const data = event.data;
      if (isRecord(data) && typeof data.message === "string") {
        failure = data.message;
      }
      terminalEvent = event.type;
      break;
    }

    if (event.type === "session.completed" || event.type === "session.waiting") {
      terminalEvent = event.type;
      break;
    }
  }

  return {
    failure,
    finalMessage,
    finishReason,
    terminalEvent,
  };
}

function isEventRecord(value: unknown): value is { type: string; data?: unknown } {
  return isRecord(value) && typeof value.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
