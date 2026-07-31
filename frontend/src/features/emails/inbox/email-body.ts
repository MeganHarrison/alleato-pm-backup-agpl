// Pure text helpers for rendering email bodies in the reading pane.
// Kept free of React imports so they can be unit-tested in isolation.

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Header keywords that some senders embed at the top of the plain-text body,
// duplicating the From/To/Date metadata already shown in the reading-pane header.
const LEADING_HEADER_RE = /^\s*(subject|date|sent|from|to|cc|bcc|reply-to)\s*:/i;

// Strip the redundant leading pseudo-header block and normalize whitespace so
// the body reads as a clean message instead of a wall of duplicated metadata.
export function cleanEmailBody(raw: string): string {
  const decoded = decodeHtmlEntities(raw);
  const lines = decoded.split(/\r?\n/);

  // Drop a contiguous run of leading header lines (and the blank lines between
  // them), but only while we're still inside the header block at the very top.
  let start = 0;
  let sawHeader = false;
  while (start < lines.length) {
    const line = lines[start];
    if (LEADING_HEADER_RE.test(line)) {
      sawHeader = true;
      start += 1;
      continue;
    }
    // Allow blank lines interleaved within the header block to be skipped too.
    if (sawHeader && line.trim() === "") {
      start += 1;
      continue;
    }
    break;
  }

  return lines
    .slice(start)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // collapse runs of blank lines
    .trim();
}
