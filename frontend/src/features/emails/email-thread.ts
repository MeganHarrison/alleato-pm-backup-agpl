// Pure helpers for reducing a stored email thread to its latest message.
//
// project_emails.body_text stores the ENTIRE reply chain inline: the new
// message, its signature, then "From: … Sent: … To: … Subject: …" quote
// headers and every prior message, separated only by those headers (no blank
// lines). Rendering that wall surfaces older messages' signatures under the
// real sender's, which reads as a contradiction (e.g. a mail "From: Brandon
// Clymer" ending in "regards, Bob Wright"). These helpers cut the thread down
// to just the latest message.

// Markers that begin a quoted reply chain underneath the latest message.
export const QUOTED_HISTORY_MARKERS: RegExp[] = [
  // Outlook inline quote header: "From: X <e> Sent: <date> To: ... Subject: ..."
  // The From:…Sent: run is on one line (the stored thread uses non-breaking
  // spaces, not newlines), so we disallow newlines to avoid bridging across a
  // leading multi-line metadata block.
  /From:[^\n]{0,220}?\bSent:\s/i,
  // "-----Original Message-----"
  /-{2,}\s*Original Message\s*-{2,}/i,
  // Gmail-style "On <date> <person> wrote:"
  /\bOn\b[^\n]{0,160}?\bwrote:/i,
  // External-sender banner tokens some tenants inject mid-thread
  /NkdkJdXPPEBannerStart/,
];

export function stripQuotedReplyHistory(value: string): string {
  let cut = value.length;
  for (const marker of QUOTED_HISTORY_MARKERS) {
    const match = marker.exec(value);
    if (match && match.index < cut) cut = match.index;
  }
  return cut < value.length ? value.slice(0, cut).trim() : value;
}

// Some senders prepend a pseudo-header block (Subject:/Date:/From:/To:) that
// duplicates the metadata already shown in the sheet header. Drop that leading
// run so the body opens on the actual message.
const LEADING_PSEUDO_HEADER_RE =
  /^\s*(subject|date|sent|from|to|cc|bcc|reply-to)\s*:/i;

export function stripLeadingPseudoHeader(value: string): string {
  const lines = value.split(/\r?\n/);
  if (lines.length === 1) {
    return value
      .replace(
        /^\s*Subject:\s.*?\sDate:\s.*?\sFrom:\s.*?\sTo:\s.*?(?=\s+(?:[A-Z][a-z]+,|Hello\b|Hi\b|Good\b|Yes\b|Please\b|Steve,|Parker,))/i,
        "",
      )
      .trim();
  }

  let start = 0;
  let sawHeader = false;
  while (start < lines.length) {
    const line = lines[start];
    if (LEADING_PSEUDO_HEADER_RE.test(line)) {
      sawHeader = true;
      start += 1;
      continue;
    }
    if (sawHeader && line.trim() === "") {
      start += 1;
      continue;
    }
    break;
  }
  return lines.slice(start).join("\n");
}

// Reduce a raw stored body to just the latest message.
export function latestMessageOnly(rawBody: string): string {
  return stripQuotedReplyHistory(stripLeadingPseudoHeader(rawBody));
}

export function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (key[0] === "#") {
      const isHex = key.startsWith("#x");
      const codePoint = Number.parseInt(key.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[key] ?? match;
  });
}

export function normalizeEmailText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    // Outlook/HTML\u2192plain-text conversion collapses paragraph and line breaks into
    // runs of spaces, which otherwise render as one unreadable wall of text. Treat
    // a run of 2+ spaces as the break it used to be: 6+ spaces = a paragraph gap,
    // 2\u20135 = a single line break. (Well-formatted emails keep single spaces, so this
    // is a no-op for them.)
    .replace(/ {2,}/g, (run) => (run.length >= 6 ? "\n\n" : "\n"))
    .replace(/\s+(From|Sent|To|Cc|Bcc|Subject):\s/gi, "\n$1: ")
    .replace(
      /\s+(Client Information Address|Your Occupation|Date of Birth|Phone No|Federal Payment|Indiana Payment|Charitable Contribution|Real Estate Taxes|Home Mortgage Interest \(Form 1098\)|Form W-2s|Form 1099-INT & DIV|Any other tax documents)\s*:?/gi,
      "\n$1: ",
    )
    .replace(
      /\s+(Please provide or verify|We would also like to ask|If yes, please upload|If you have the following|You can upload the documents|For reference, here is the permalink|If you have any questions|Thank you for your time and cooperation\.|CONFIDENTIALITY NOTICE:)/gi,
      "\n\n$1",
    )
    .replace(/\s+(Caution:\s*EXTERNAL EMAIL)\s*/gi, "\n$1\n")
    .replace(/\s+(Best|Regards|Thank you),\s+/gi, "\n\n$1,\n")
    .replace(
      /([?.!])\s+(Thank you|Thank You|Thanks|Best|Regards)\b/g,
      "$1\n\n$2",
    )
    .replace(
      /\b(Thank you|Thank You|Thanks|Best|Regards)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g,
      "$1\n$2",
    )
    .replace(
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(CEO at Alleato Group|Assistant Project Manager at Alleato Group)\b/g,
      "$1\n$2",
    )
    .replace(
      /(\b(?:uploaded to the SharePoint|attached|attachments?)\b.*?)\s+((?:\d{2,4}-\d{3,6}[-A-Za-z0-9(),.&/ ]{12,}))$/i,
      "$1\n\n$2",
    )
    .replace(
      /\s+(\d{2,4}-\d{3,6}[-A-Za-z0-9(),.&/ ]{10,}?(?:Rev\s+[A-Z0-9]+)?)(?=\s+Rev\s+[A-Z0-9]+:|\s+\d{2,4}-\d{3,6}\b|\s+[A-Z][A-Z]+ [A-Z][A-Z]+\s+\|)/g,
      "\n\n$1",
    )
    .replace(
      /\s+((?:\d{2,4}-\d{3,6}[-A-Za-z0-9(),.&/ ]{10,}?(?:Rev\s+[A-Z0-9]+)?))(?:\s+(?=\d{2,4}-\d{3,6}\b))/g,
      "\n$1\n",
    )
    .replace(/\s+(Rev\s+[A-Z0-9]+:\s+)/g, "\n$1")
    .replace(/\s+\b([A-Z][A-Z]+\s+[A-Z][A-Z]+)\s+\|\s+/g, "\n\n$1\n")
    .replace(/\s+\b(senior project engineer)\b\s+/gi, "\n$1\n")
    .replace(/\s+\b(e:\s*[^@\s]+@[^@\s]+\.[^@\s]+)\b/gi, "\n$1\n")
    .replace(/\s+\b(www\.[^\s]+)\b/gi, "\n$1\n")
    .replace(/\s+\b(SYMBOTIC\s+\d{2,6}\s+Research Drive.*?)\b(?=\s+\*\*Symbotic Confidential\*\*|\s+$)/i, "\n$1\n")
    .replace(/\s+\*\*Symbotic Confidential\*\*[\s\S]*$/i, "")
    .replace(
      /\n+[A-Z][A-Z]+ [A-Z][A-Z]+\n(?:senior project engineer\n)?e:\s*[^@\s]+@[^@\s]+\.[^\s]+\nwww\.symbotic\.com[\s\S]*$/i,
      "",
    )
    .replace(
      /\s+(Assistant Project Manager at Alleato Group|Mobile|Email|Web|Indianapolis\s+-|Tampa\/St Pete\s+-)\s*/g,
      "\n$1 ",
    )
    .replace(/\s+(Andrew|Anthony|Kevin|Keegan|Joseph)\b/g, "\n$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function latestReadableMessage(rawBody: string): string {
  return normalizeEmailText(latestMessageOnly(rawBody));
}

export type EmailContentBlock = {
  id: string;
  kind: "paragraph" | "metadata" | "warning" | "quote-header";
  lines: string[];
};

const OUTLOOK_HEADER_RE = /^(From|Sent|Date|To|Cc|Bcc|Subject):\s*(.*)$/i;
const SIGNATURE_NOISE_RE =
  /^(Assistant Project Manager at Alleato Group|Mobile\b|Web\b|www\.alleatogroup\.com|www\.symbotic\.com|Indianapolis\s+-|Tampa\/St Pete\s+-|\||e:\s*[^@\s]+@|senior project engineer$|SYMBOTIC\s+\d{2,6}\s+Research Drive)/i;

function shouldDropSignatureLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (SIGNATURE_NOISE_RE.test(trimmed)) return true;
  if (/^\d{3}[.\-\s]\d{3}[.\-\s]\d{4}(?:\s*\|\s*)?$/.test(trimmed)) return true;
  if (/^Email\s+[^@\s]+@/i.test(trimmed)) return true;
  if (/^acannon@alleatogroup\.com$/i.test(trimmed)) return true;
  if (/8383 Craig Street|701 94th Avenue|alleatogroup\.com|Symbotic Confidential|Reinvent the warehouse|Research Drive Wilmington/i.test(trimmed)) return true;
  return false;
}

export function buildEmailContentBlocks(rawBody: string): EmailContentBlock[] {
  const normalized = latestReadableMessage(rawBody);

  if (!normalized) {
    return [
      {
        id: "empty",
        kind: "paragraph",
        lines: ["No email body is stored for this message."],
      },
    ];
  }

  const blocks: EmailContentBlock[] = [];
  let paragraph: string[] = [];
  let metadata: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      id: `paragraph-${blocks.length}`,
      kind: "paragraph",
      lines: paragraph,
    });
    paragraph = [];
  };

  const flushMetadata = () => {
    if (metadata.length === 0) return;
    blocks.push({
      id: `metadata-${blocks.length}`,
      kind: metadata[0].toLowerCase().startsWith("from:") ? "quote-header" : "metadata",
      lines: metadata,
    });
    metadata = [];
  };

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushMetadata();
      flushParagraph();
      continue;
    }

    if (shouldDropSignatureLine(line)) continue;

    if (/^Caution:\s*EXTERNAL EMAIL$/i.test(line)) {
      flushMetadata();
      flushParagraph();
      blocks.push({
        id: `warning-${blocks.length}`,
        kind: "warning",
        lines: ["External email"],
      });
      continue;
    }

    if (OUTLOOK_HEADER_RE.test(line)) {
      flushParagraph();
      metadata.push(line);
      continue;
    }

    flushMetadata();
    paragraph.push(line);
  }

  flushMetadata();
  flushParagraph();

  return blocks;
}
