/**
 * Collapse per-mailbox copies of the same Outlook email down to one row.
 *
 * The Microsoft Graph sync ingests one `outlook_email_intake` row **per
 * mailbox** that received a message. When several Alleato employees are on the
 * same email (To/Cc), the identical message is stored once per mailbox — each
 * copy carrying its own per-mailbox `graph_message_id`. Listing a project's (or
 * the global) inbox would then render that one message 2–3× — the "everything
 * shows twice" bug.
 *
 * The RFC-822 `internet_message_id` is identical across every mailbox copy, so
 * it is the stable identity of a physical email. This helper groups by it and
 * keeps a single representative per group.
 *
 * Rows with a missing `internet_message_id` cannot be safely grouped, so each
 * is kept as its own message (never merged with anything else).
 *
 * IMPORTANT: this is a READ-path collapse only. The per-mailbox rows MUST stay
 * in the table — mailbox-scoped surfaces (the feedback inbox / mailbox review
 * mode, which filter by `mailbox_user_id`) legitimately need every copy. Only
 * project-wide and global list views should dedupe.
 */
export interface OutlookIntakeDedupeRow {
  id: number;
  internet_message_id?: string | null;
  project_email_id?: number | null;
}

export interface DedupeOutlookIntakeResult<T extends OutlookIntakeDedupeRow> {
  /** One row per physical email, order-preserved from the input. */
  representatives: T[];
  /** representative id → every intake row id that collapsed into it (incl. itself). */
  memberIdsByRepresentativeId: Map<number, number[]>;
}

function isPresent(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Pick the stable representative for a group of identical emails: prefer a copy
 * already linked to an app `project_emails` row (so downstream affordances that
 * key off `project_email_id` keep working), then the lowest intake id. Both
 * criteria are deterministic, so the same email always resolves to the same
 * representative across requests — selection/detail panels stay stable.
 */
function pickRepresentative<T extends OutlookIntakeDedupeRow>(a: T, b: T): T {
  const aLinked = a.project_email_id != null;
  const bLinked = b.project_email_id != null;
  if (aLinked !== bLinked) return aLinked ? a : b;
  return a.id <= b.id ? a : b;
}

export function dedupeOutlookIntakeByMessageId<T extends OutlookIntakeDedupeRow>(
  rows: T[],
): DedupeOutlookIntakeResult<T> {
  const groups = new Map<string, T[]>();
  const order: string[] = [];

  for (const row of rows) {
    // Null/blank message ids can't be grouped — give each its own bucket keyed
    // by intake id so they never collapse into one another.
    const key = isPresent(row.internet_message_id)
      ? `imid:${row.internet_message_id.trim().toLowerCase()}`
      : `row:${row.id}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(key, [row]);
      order.push(key);
    }
  }

  const representatives: T[] = [];
  const memberIdsByRepresentativeId = new Map<number, number[]>();

  for (const key of order) {
    const bucket = groups.get(key)!;
    const representative = bucket.reduce(pickRepresentative);
    representatives.push(representative);
    memberIdsByRepresentativeId.set(
      representative.id,
      bucket.map((row) => row.id),
    );
  }

  return { representatives, memberIdsByRepresentativeId };
}
