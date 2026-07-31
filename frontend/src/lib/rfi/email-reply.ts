/**
 * Pure helpers for ingesting subcontractor RFI replies that arrive in the
 * Outlook reply mailbox. Kept free of I/O so they can be unit-tested.
 *
 * Token delivery (most reliable first):
 *   1. Plus-address on the reply's To/Cc:  rfi+<token>@alleatogroup.com
 *      (Outlook subaddressing preserves the +token in the delivered header)
 *   2. The magic-link URL quoted in the reply body:  /respond/rfi/<token>
 */

/** Local-part + domain of the shared reply mailbox (e.g. "rfi@alleatogroup.com"). */
export interface RfiReplyMailbox {
  localPart: string;
  domain: string;
  address: string;
}

export function parseReplyMailbox(address: string | undefined | null): RfiReplyMailbox | null {
  if (!address) return null;
  const trimmed = address.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  return {
    localPart: trimmed.slice(0, at),
    domain: trimmed.slice(at + 1),
    address: trimmed,
  };
}

/** Build the per-recipient reply-to address that carries the token. */
export function buildRfiReplyAddress(mailbox: RfiReplyMailbox, token: string): string {
  return `${mailbox.localPart}+${token}@${mailbox.domain}`;
}

// Token = base64url (24 bytes → 32 chars). Allow 16+ to be tolerant.
const TOKEN_CHARS = "[A-Za-z0-9_-]{16,}";

/**
 * Pull the token out of the reply's recipient addresses by matching the
 * mailbox plus-address pattern `rfi+<token>@domain`.
 */
export function extractTokenFromRecipients(
  recipients: string[],
  mailbox: RfiReplyMailbox,
): string | null {
  const pattern = new RegExp(
    `^${escapeRegExp(mailbox.localPart)}\\+(${TOKEN_CHARS})@${escapeRegExp(mailbox.domain)}$`,
    "i",
  );
  for (const raw of recipients) {
    const addr = extractEmailAddress(raw);
    if (!addr) continue;
    // Match case-insensitively (the `i` flag covers the local part + domain) but
    // do NOT lowercase the string — the token is case-sensitive base64url.
    const match = addr.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Fallback: pull the token from a `/respond/rfi/<token>` URL in the quoted body. */
export function extractTokenFromBody(body: string): string | null {
  if (!body) return null;
  const match = body.match(new RegExp(`/respond/rfi/(${TOKEN_CHARS})`));
  return match ? match[1] : null;
}

/** Resolve the token from a reply using recipients first, then body. */
export function extractReplyToken(
  recipients: string[],
  body: string,
  mailbox: RfiReplyMailbox,
): string | null {
  return extractTokenFromRecipients(recipients, mailbox) ?? extractTokenFromBody(body);
}

// Markers that begin the quoted original message. Everything from the first
// match onward is dropped, leaving just what the sub actually typed.
const QUOTE_MARKERS: RegExp[] = [
  /^>/, // quoted line
  /^On .+ wrote:\s*$/i, // "On Tue, Jun 24, 2026 at 9:00 AM, Name <e@x> wrote:"
  /^-----\s*Original Message\s*-----/i,
  /^________+\s*$/, // Outlook horizontal divider
  /^From:\s.+/i, // Outlook quoted header block
  /^Sent from my /i, // mobile signature preamble that often precedes quotes
];

/**
 * Strip the quoted original and trailing signature from a reply body, returning
 * just the new text. Conservative: if nothing matches, returns the trimmed body.
 */
export function stripQuotedReply(body: string): string {
  if (!body) return "";
  const normalized = body.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    if (QUOTE_MARKERS.some((marker) => marker.test(line.trim()))) break;
    kept.push(line);
  }

  // Drop a trailing "-- " signature delimiter and everything after it.
  const sigIndex = kept.findIndex((line) => line.trim() === "--");
  const body2 = (sigIndex >= 0 ? kept.slice(0, sigIndex) : kept).join("\n");
  return body2.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Extract a bare email from a "Name <email>" or plain address string. */
function extractEmailAddress(raw: string): string | null {
  if (!raw) return null;
  const angle = raw.match(/<([^>]+)>/);
  const candidate = (angle ? angle[1] : raw).trim();
  return candidate.includes("@") ? candidate : null;
}
