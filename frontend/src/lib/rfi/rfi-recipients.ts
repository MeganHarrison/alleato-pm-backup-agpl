/**
 * RFI notification recipient resolution.
 *
 * RFI person fields (`assignees`, `distribution_list`, `rfi_manager`,
 * `created_by`) are `text[]`/`text` columns with NO foreign key. The RFI
 * create/edit form (`useRfiManagerOptions` in `rfi-form-fields.tsx`) stores
 * the selected person's DISPLAY NAME (e.g. "Brandon Clymer") as the value —
 * not a UUID. Historical rows may also contain UUIDs (older form) or raw
 * email addresses (`created_by`).
 *
 * The close-notification path must therefore accept ALL THREE shapes and
 * resolve every one back to a `people` row. A previous implementation only
 * kept UUID-shaped entries, which silently dropped every name-shaped
 * recipient — so distribution-list members and name-shaped assignees never
 * received the RFI-closed email.
 *
 * This module isolates that classification as a pure function so it can be
 * unit-tested without the API route's server-only dependencies.
 */

export const RFI_RECIPIENT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ClassifiedRfiRecipients {
  /** UUID-shaped entries — resolve via `people.id`. */
  personIds: Set<string>;
  /** Email-shaped entries — resolve via `people.email`. */
  emails: Set<string>;
  /** Name-shaped entries (normalized lowercase) — resolve via full name. */
  names: Set<string>;
}

/** Normalized lookup key for a person's full name. */
export function personFullNameKey(
  firstName?: string | null,
  lastName?: string | null,
): string {
  return `${firstName ?? ""} ${lastName ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Classify raw RFI recipient entries (from any of the person columns) into the
 * three resolvable shapes. Blank/nullish entries are skipped.
 */
export function classifyRfiRecipientEntries(
  entries: Array<string | null | undefined>,
): ClassifiedRfiRecipients {
  const personIds = new Set<string>();
  const emails = new Set<string>();
  const names = new Set<string>();

  for (const raw of entries) {
    if (!raw) continue;
    const value = raw.trim();
    if (!value) continue;

    if (RFI_RECIPIENT_UUID_PATTERN.test(value)) {
      personIds.add(value);
    } else if (value.includes("@")) {
      emails.add(value);
    } else {
      names.add(value.replace(/\s+/g, " ").toLowerCase());
    }
  }

  return { personIds, emails, names };
}
