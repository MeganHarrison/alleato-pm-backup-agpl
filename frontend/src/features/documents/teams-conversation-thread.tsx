import * as React from "react";

/**
 * Renders a compiled Teams DM conversation bucket as a readable chat thread.
 *
 * Teams conversation buckets store messages inline in the `content` field as
 * `[message:<id>] [<timestamp>] <Sender>: <text>`. This parses that into a
 * proper thread — date dividers, sender, time, consecutive-sender grouping —
 * instead of dumping the raw blob. This is the immediate "I can read my Teams
 * messages" view; the durable per-message data model is a separate redesign.
 */

export type ParsedTeamsMessage = {
  id: string;
  timestamp: string; // raw "YYYY-MM-DD HH:MM:SS" as stored in the bucket
  sender: string;
  text: string;
};

const MESSAGE_RE =
  /\[message:([^\]]+)\]\s*\[(\d{4}-\d{2}-\d{2}[ T][\d:]+)\]\s*([^:[\]]+?):\s*([\s\S]*?)(?=\s*\[message:[^\]]+\]|$)/g;

export function parseTeamsConversation(content: string | null | undefined): ParsedTeamsMessage[] {
  if (!content) return [];
  const messages: ParsedTeamsMessage[] = [];
  MESSAGE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MESSAGE_RE.exec(content)) !== null) {
    const text = match[4]
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    messages.push({
      id: match[1],
      timestamp: match[2].replace("T", " "),
      sender: match[3].trim(),
      text,
    });
  }
  return messages;
}

function dayOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function timeOf(timestamp: string): string {
  // Show HH:MM as stored. Timezone normalization is handled in the redesign;
  // within a single conversation these are internally consistent.
  const time = timestamp.slice(11, 16);
  return time || timestamp;
}

function formatDayLabel(day: string): string {
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  return parsed.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TeamsConversationThread({ messages }: { messages: ParsedTeamsMessage[] }) {
  if (messages.length === 0) return null;

  let lastDay = "";
  let lastSender = "";

  return (
    <div className="space-y-1.5">
      {messages.map((message) => {
        const day = dayOf(message.timestamp);
        const showDay = day !== lastDay;
        const showSender = showDay || message.sender !== lastSender;
        lastDay = day;
        lastSender = message.sender;
        return (
          <React.Fragment key={message.id}>
            {showDay ? (
              <div className="flex items-center gap-3 py-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground">
                  {formatDayLabel(day)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <div className={showSender ? "pt-2" : ""}>
              {showSender ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">{message.sender}</span>
                  <span className="text-xs text-muted-foreground">{timeOf(message.timestamp)}</span>
                </div>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.text}</p>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
