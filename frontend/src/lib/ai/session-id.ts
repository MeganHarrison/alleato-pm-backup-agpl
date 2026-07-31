import { createHash } from "node:crypto";

/**
 * Convert an arbitrary session identifier into a deterministic UUID.
 *
 * Why this exists:
 *   chat_history.session_id is a `uuid NOT NULL` column. The web chat
 *   passes `crypto.randomUUID()` so it inserts cleanly. The bot
 *   integrations (Teams, Telegram) construct human-readable sessionIds
 *   like `teams:<supabaseUserId>:<threadId>` or `telegram:<userId>` so
 *   memory continuity works across messages — but those strings fail
 *   the uuid type check, every insert silently rejects, and zero bot
 *   chat history persists.
 *
 *   This util converts any non-UUID string into a deterministic v5 UUID
 *   using a fixed app namespace, so the bot's logical session identity
 *   is preserved (same input string → same UUID → continuous memory)
 *   while satisfying the column type. Real UUIDs pass through unchanged.
 *
 * Algorithm: RFC 4122 §4.3 — UUID v5 (SHA-1 namespace + name).
 */

// Fixed namespace UUID. Generated once and never changed; if it changes,
// every bot session loses its history continuity.
const SESSION_NAMESPACE_HEX = "a8f3c7e21b4d4e6a9c5f2d8b7a1e4f3c";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function toSessionUuid(input: string): string {
  if (UUID_RE.test(input)) return input;

  const namespaceBytes = Buffer.from(SESSION_NAMESPACE_HEX, "hex");
  const nameBytes = Buffer.from(input, "utf8");
  const hash = createHash("sha1")
    .update(namespaceBytes)
    .update(nameBytes)
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  // Set version (5) in byte 6, high nibble
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  // Set RFC 4122 variant in byte 8, top two bits = 10
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}
