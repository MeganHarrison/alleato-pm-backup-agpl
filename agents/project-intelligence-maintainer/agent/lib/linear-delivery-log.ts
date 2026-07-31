const LINEAR_SESSION_TOKEN_PREFIX = "agent-session:";
const MAX_ACTIVITY_BODY_LENGTH = 500;

type JsonValue = boolean | number | string | null | JsonValue[] | { [key: string]: JsonValue };

export function readLinearAgentSessionIdFromContinuationToken(token: string): string | null {
  if (!token.startsWith(LINEAR_SESSION_TOKEN_PREFIX)) return null;

  const agentSessionId = token.slice(LINEAR_SESSION_TOKEN_PREFIX.length).trim();
  return agentSessionId.length > 0 ? agentSessionId : null;
}

export function logLinearDeliveryEvent(event: string, details: Record<string, JsonValue>): void {
  console.warn(
    `LINEAR_READBACK ${JSON.stringify({
      channel: "linear",
      event,
      ...details,
    })}`,
  );
}

export function truncateActivityBody(body: string): string {
  if (body.length <= MAX_ACTIVITY_BODY_LENGTH) return body;
  return `${body.slice(0, MAX_ACTIVITY_BODY_LENGTH)}…`;
}
