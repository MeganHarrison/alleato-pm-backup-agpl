export type ReadableEmailMessage = {
  id: string;
  subject: string;
  date: string;
  from: string;
  to: string;
  cc: string;
  body: string;
};

const headerPattern = /^(Subject|Date|Sent|From|To|Cc):\s*(.*)$/i;
const messageStartPattern = /^(From:|On .+wrote:|-{2,}\s*Original Message\s*-{2,})/i;
const signoffPattern =
  /^(--|best,?|thanks,?|thanks again,?|thank you,?|regards,?|respectfully,?|sincerely,?|have a nice day!?)$/i;
const contactNoisePattern =
  /\b(assistant project manager|project manager|mobile|email|web|www\.|alleatogroup\.com|indianapolis|tampa|st\. petersburg)\b/i;

export function cleanEmailText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function normalizeEmailThreadText(value: string): string {
  return cleanEmailText(value)
    .replace(/([^\n])\s+(From|Sent|Date|To|Cc|Subject):\s+/g, "$1\n$2: ")
    .replace(/([.!?])\s+(Best,|Thanks again,|Thank you,|Thanks,|Regards,|Respectfully,|Sincerely,|Have a nice day!)/gi, "$1\n$2")
    .replace(/\s+(Best,|Thanks again,|Thank you,|Thanks,|Regards,|Respectfully,|Sincerely,|Have a nice day!)\s+/gi, "\n$1\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{3,}/g, "  ")
    .trim();
}

function normalizeHeaderKey(value: string): keyof Omit<ReadableEmailMessage, "id" | "body"> {
  const key = value.toLowerCase();
  return key === "sent" ? "date" : (key as keyof Omit<ReadableEmailMessage, "id" | "body">);
}

function emptyMessage(index: number): ReadableEmailMessage {
  return {
    id: `email-message-${index}`,
    subject: "",
    date: "",
    from: "",
    to: "",
    cc: "",
    body: "",
  };
}

function cleanEmailBody(value: string): string {
  const lines = value
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/^>/.test(line.trim()));

  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    const next = lines[index + 1]?.trim() ?? "";

    if (signoffPattern.test(line)) {
      const remaining = lines.slice(index + 1).join(" ");
      if (contactNoisePattern.test(remaining) || remaining.length > 40) {
        break;
      }
    }

    if (contactNoisePattern.test(line) && (line.includes("@") || /\d{3}[.\-\s]\d{3}/.test(line))) {
      break;
    }

    if (/^\[cid:|^image\d+\./i.test(line)) continue;
    if (!line && !next && kept.at(-1) === "") continue;
    kept.push(lines[index] ?? "");
  }

  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseHeaderBlock(lines: string[], startIndex: number, message: ReadableEmailMessage) {
  let index = startIndex;
  let lastHeader: keyof Omit<ReadableEmailMessage, "id" | "body"> | null = null;

  for (; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line) {
      index += 1;
      break;
    }

    const match = line.match(headerPattern);
    if (match) {
      const key = normalizeHeaderKey(match[1]);
      message[key] = match[2].trim();
      lastHeader = key;
      continue;
    }

    if (lastHeader && /^\s/.test(lines[index] ?? "")) {
      message[lastHeader] = `${message[lastHeader]} ${line}`.trim();
      continue;
    }

    break;
  }

  return index;
}

export function parseReadableEmailThread(value: string | null | undefined): ReadableEmailMessage[] {
  const text = normalizeEmailThreadText(value ?? "");
  if (!text) return [];

  const lines = text.split("\n");
  const messages: ReadableEmailMessage[] = [];
  let index = 0;

  while (index < lines.length) {
    while (index < lines.length && !lines[index]?.trim()) index += 1;
    if (index >= lines.length) break;

    const message = emptyMessage(messages.length);
    const firstLine = lines[index]?.trim() ?? "";

    if (/^On .+wrote:$/i.test(firstLine)) {
      message.from = firstLine.replace(/^On\s+/i, "").replace(/\s+wrote:$/i, "");
      index += 1;
    } else if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(firstLine)) {
      index += 1;
      index = parseHeaderBlock(lines, index, message);
    } else if (headerPattern.test(firstLine)) {
      index = parseHeaderBlock(lines, index, message);
    }

    const bodyStart = index;
    while (index < lines.length) {
      const line = lines[index]?.trim() ?? "";
      if (index > bodyStart && messageStartPattern.test(line)) break;
      index += 1;
    }

    message.body = cleanEmailBody(lines.slice(bodyStart, index).join("\n"));
    if (message.subject || message.date || message.from || message.to || message.cc || message.body) {
      messages.push(message);
    }
  }

  return messages;
}

export function getPrimaryReadableEmail(value: string | null | undefined): ReadableEmailMessage | null {
  return parseReadableEmailThread(value)[0] ?? null;
}
