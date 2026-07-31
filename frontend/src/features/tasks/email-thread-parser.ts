export type EmailThreadMessage = {
  id: string;
  subject: string | null;
  date: string | null;
  from: string | null;
  to: string | null;
  body: string;
};

export type TeamsConversationMessage = {
  date: string;
  author: string;
  body: string;
};

export type TeamsConversation = {
  title: string;
  date: string | null;
  messages: TeamsConversationMessage[];
};

export type MeetingContextItem = {
  label: string;
  body: string;
};

export type MeetingContextSection = {
  title: string;
  body: string | null;
  items: MeetingContextItem[];
};

export type MeetingContext = {
  sections: MeetingContextSection[];
};

type ParsedContextField = {
  value: string;
  bodyStart: number;
};

const MEETING_METADATA_SECTION_PATTERN =
  /(?:^|\n)\s*#{1,6}\s*(?:User|Speakers|Meeting Attendees|Meeting Attendance|Meeting Info|Analytics)\s*```(?:json)?[\s\S]*?```/gi;

function removeMeetingMetadataBlocks(value: string): string {
  return value
    .replace(MEETING_METADATA_SECTION_PATTERN, "\n")
    .replace(/```(?:json)?\s*(?:\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/gi, "\n");
}

export function cleanSourceContextText(value: string): string {
  return removeMeetingMetadataBlocks(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getHeaderBoundary(label: string, value: string): number {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel === "to" || normalizedLabel === "from" || normalizedLabel === "cc") {
    const firstBodyMarker = value.search(/\s(?:hello|hi|thank you|thanks|please|lucy,|from:|who|see below|@)\b/i);
    const beforeBody = firstBodyMarker > 0 ? value.slice(0, firstBodyMarker) : value;
    const lastRecipientEnd = beforeBody.lastIndexOf(">");
    return lastRecipientEnd >= 0 ? lastRecipientEnd + 1 : beforeBody.trimEnd().length;
  }

  if (normalizedLabel === "subject") {
    const firstBodyMarker = value.search(/\s(?:hello|hi|who|please|see below|@|we\b|i\b|thank you|thanks)\b/i);
    return firstBodyMarker > 0 ? firstBodyMarker : value.trimEnd().length;
  }

  return value.trimEnd().length;
}

function parseContextFields(text: string): Map<string, ParsedContextField> {
  const labelPattern = /\b(Subject|Date|From|To|Cc|Sent):\s*/gi;
  const matches = Array.from(text.matchAll(labelPattern));
  const fields = new Map<string, ParsedContextField>();

  matches.forEach((match, index) => {
    const label = match[1];
    const valueStart = match.index + match[0].length;
    const valueEnd = matches[index + 1]?.index ?? text.length;
    const rawValue = text.slice(valueStart, valueEnd);
    const boundary = getHeaderBoundary(label, rawValue);
    const value = rawValue.slice(0, boundary).trim();

    if (value && !fields.has(label.toLowerCase())) {
      fields.set(label.toLowerCase(), {
        value,
        bodyStart: valueStart + boundary,
      });
    }
  });

  return fields;
}

export function extractContextField(text: string, label: string): string | null {
  return parseContextFields(text).get(label.toLowerCase())?.value ?? null;
}

function findEmailMessageStarts(text: string): number[] {
  const starts: number[] = [];
  const pattern = /\bFrom:\s+[^<]{0,160}<[^>]+>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    starts.push(match.index);
  }

  if (starts.length === 0) return [0];
  if (starts[0] <= 5) return starts;
  return [0, ...starts.slice(1)];
}

export function cleanRecipientField(value: string | null): string | null {
  if (!value) return null;
  const names = value
    .split(/[;,]\s*/)
    .map((part) => cleanContactLabel(part))
    .filter(Boolean);
  const cleaned = names.length > 0 ? names.join(", ") : cleanContactLabel(value);
  return cleaned.length > 180 ? `${cleaned.slice(0, 180).trim()}...` : cleaned.trim();
}

export function cleanContactLabel(value: string | null): string {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanMessageBody(value: string): string {
  return value
    .replace(/\b(?:Thank You|Thank you|Thanks|Regards|Best),?\s+[\s\S]*$/i, "")
    .replace(/\b(?:Mobile|Phone|Email|Web)\s*:?.*$/i, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTeamsConversation(text: string): TeamsConversation | null {
  const headerMatch = text.match(/^\[Teams Direct Message Conversation:\s*([^\]]+)](?:\s+Date:\s*([0-9-]+))?/i);
  if (!headerMatch) return null;

  const messages: TeamsConversationMessage[] = [];
  const messagePattern = /\[message:\d+]\s*\[([0-9-]+\s+[0-9:]+)]\s*([^:]+):\s*([\s\S]*?)(?=\s*\[message:\d+]\s*\[[0-9-]+\s+[0-9:]+]|\s*$)/g;
  let match: RegExpExecArray | null;

  while ((match = messagePattern.exec(text)) !== null) {
    const body = match[3]
      .replace(/\s+/g, " ")
      .trim();

    if (!body) continue;

    messages.push({
      date: match[1].trim(),
      author: match[2].trim(),
      body,
    });
  }

  return {
    title: headerMatch[1].trim(),
    date: headerMatch[2]?.trim() ?? null,
    messages,
  };
}

function cleanMarkdownText(value: string): string {
  return value
    .replace(/^\{\}\s*/, "")
    .replace(/^#\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/^[-\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMeetingItems(value: string): { items: MeetingContextItem[]; body: string | null } {
  const markerPattern = /(?:^|\s+-\s+)(?:\*\*)?([A-Z][^:*#]{1,80}):(?:\*\*)?\s*/g;
  const matches = Array.from(value.matchAll(markerPattern));

  if (matches.length === 0) {
    return {
      items: [],
      body: cleanMarkdownText(value) || null,
    };
  }

  const items = matches
    .map((match, index) => {
      const bodyStart = (match.index ?? 0) + match[0].length;
      const bodyEnd = matches[index + 1]?.index ?? value.length;

      return {
        label: cleanMarkdownText(match[1]),
        body: cleanMarkdownText(value.slice(bodyStart, bodyEnd)),
      };
    })
    .filter((item) => item.label && item.body);

  const firstMarkerIndex = matches[0]?.index ?? 0;
  const body = cleanMarkdownText(value.slice(0, firstMarkerIndex));

  return {
    items,
    body: body || null,
  };
}

export function parseMeetingContext(text: string): MeetingContext | null {
  const normalized = cleanSourceContextText(text)
    .replace(/^\{\}\s*/, "")
    .replace(/^#\s*/, "")
    .replace(/\s+Duration:\s*.*?(?=\s+(?:Participants|Summary|Gist|Short Summary|Action Items|Next Steps|Key Points|Decisions|Risks|Keywords)\b|$)/i, " ")
    .replace(/\s+Participants:\s*.*?(?=\s+(?:Summary|Gist|Short Summary|Action Items|Next Steps|Key Points|Decisions|Risks|Keywords)\b|$)/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  const headingPattern = /(?:^|\s+)(?:##\s*)?(Short Summary|Action Items|Next Steps|Key Points|Decisions|Summary|Risks|Gist|Keywords)\b/g;
  const headingMatches = Array.from(normalized.matchAll(headingPattern));

  if (headingMatches.length === 0 && !/(?:^|\s+-\s+)(?:\*\*)?[A-Z][^:*#]{1,80}:\*\*/.test(normalized)) {
    return null;
  }

  const sections: MeetingContextSection[] = [];

  if (headingMatches.length === 0) {
    const parsed = parseMeetingItems(normalized);

    return parsed.body || parsed.items.length > 0
      ? { sections: [{ title: "Highlights", body: parsed.body, items: parsed.items }] }
      : null;
  }

  const firstHeadingIndex = headingMatches[0]?.index ?? 0;
  const rawPrefix = normalized.slice(0, firstHeadingIndex);
  const prefix = cleanMarkdownText(rawPrefix);

  if (prefix && /(?:^|\s+-\s+)(?:\*\*)?[A-Z][^:*#]{1,80}:\*\*/.test(rawPrefix)) {
    const parsed = parseMeetingItems(rawPrefix);

    if (parsed.body || parsed.items.length > 0) {
      sections.push({
        title: "Highlights",
        body: parsed.body,
        items: parsed.items,
      });
    }
  }

  headingMatches.forEach((match, index) => {
    const title = cleanMarkdownText(match[1]);
    const contentStart = (match.index ?? 0) + match[0].length;
    const contentEnd = headingMatches[index + 1]?.index ?? normalized.length;
    const parsed = parseMeetingItems(normalized.slice(contentStart, contentEnd));

    if (parsed.body || parsed.items.length > 0) {
      sections.push({
        title,
        body: parsed.body,
        items: parsed.items,
      });
    }
  });

  return sections.length > 0 ? { sections } : null;
}

export function extractContextBody(text: string): string {
  const fields = parseContextFields(text);
  const bodyStart = Math.max(0, ...Array.from(fields.values()).map((field) => field.bodyStart));

  return cleanMessageBody(text.slice(bodyStart));
}

export function parseEmailThread(text: string): EmailThreadMessage[] {
  const starts = findEmailMessageStarts(text);

  return starts
    .map((start, index) => {
      const end = starts[index + 1] ?? text.length;
      const chunk = text.slice(start, end).trim();
      const fields = parseContextFields(chunk);
      const subject = fields.get("subject")?.value ?? null;
      const date = fields.get("date")?.value ?? fields.get("sent")?.value ?? null;
      const from = cleanContactLabel(fields.get("from")?.value ?? null) || null;
      const to = cleanRecipientField(fields.get("to")?.value ?? null);
      const bodyStart = Math.max(0, ...Array.from(fields.values()).map((field) => field.bodyStart));
      const body = cleanMessageBody(chunk.slice(bodyStart));

      return {
        id: `message-${index}`,
        subject,
        date,
        from,
        to,
        body: body || chunk,
      };
    })
    .filter((message) => message.body || message.subject || message.from);
}
