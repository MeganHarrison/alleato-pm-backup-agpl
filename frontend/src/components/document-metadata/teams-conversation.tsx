interface TeamsMessage {
  id: string;
  timestamp: string;
  sender: string;
  text: string;
}

export function parseTeamsContent(content: string): TeamsMessage[] | null {
  const pattern = /\[message:(\d+)\]\s*\[([^\]]+)\]\s*([^:]+):\s*([\s\S]*?)(?=\s*\[message:|\s*$)/g;
  const messages: TeamsMessage[] = [];
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const text = match[4].trim();
    if (!text) continue;
    messages.push({
      id: match[1],
      timestamp: match[2].trim(),
      sender: match[3].trim(),
      text,
    });
  }

  return messages.length > 0 ? messages : null;
}

function formatTeamsTime(timestamp: string) {
  try {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

export function getFirstTeamsMessageTimestamp(content: string | null | undefined) {
  if (!content) return null;
  return parseTeamsContent(content)?.[0]?.timestamp ?? null;
}

export function TeamsConversation({ content }: { content: string }) {
  const messages = parseTeamsContent(content);

  if (!messages) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {content}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className="space-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-foreground">
              {message.sender}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTeamsTime(message.timestamp)}
            </span>
          </div>
          <p className="max-w-5xl whitespace-normal break-words text-sm leading-relaxed text-foreground">
            {message.text}
          </p>
        </div>
      ))}
    </div>
  );
}
