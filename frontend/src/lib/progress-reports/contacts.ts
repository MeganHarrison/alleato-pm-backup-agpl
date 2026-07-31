import type { ProgressReportContact } from "@/lib/progress-reports/types";

/**
 * Contact resolution for progress reports.
 *
 * A progress report stores its contact block as a JSON array on
 * `project_progress_reports.contacts`. That stored array is the **curated**
 * contact list for the report: it is seeded from the live project team when the
 * draft is first created, and from then on the PM owns it (add / edit / remove).
 *
 * The live project team (roles + directory memberships) is only ever a *source*
 * for the initial seed and a fallback for legacy/empty reports — never a list
 * that gets force-merged back in on every read. Force-merging the team in on
 * read made it impossible to remove a team-derived contact: the removal saved to
 * the column, then the next read re-injected the person. See
 * `resolveProgressReportContacts` below for the authoritative read behaviour.
 */

function contactKey(contact: ProgressReportContact): string {
  return (contact.email || contact.name || contact.phone || contact.role).toLowerCase();
}

/**
 * Dedupe-merge two contact lists, preserving order with `primary` first.
 * Used when seeding a brand-new draft's contact block from project-team sources.
 */
export function mergeProgressReportContacts(
  primary: ProgressReportContact[],
  secondary: ProgressReportContact[],
): ProgressReportContact[] {
  const contacts: ProgressReportContact[] = [];
  const seen = new Set<string>();

  for (const contact of [...primary, ...secondary]) {
    const key = contactKey(contact);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    contacts.push(contact);
  }

  return contacts;
}

/**
 * Resolves the contact list returned to the editor/PDF/email for an EXISTING
 * report.
 *
 * The stored contacts are authoritative: if the report has any saved contacts,
 * they are returned as-is so that PM edits — including removals — always persist.
 * The live project team is used only as a fallback for reports whose stored
 * contact block is empty (legacy reports created before contacts were seeded, or
 * a report whose contacts were all cleared), so those still show something useful.
 *
 * Guardrail: removing a team-derived contact MUST survive a re-read. This is the
 * function that guarantees it — do not reintroduce an unconditional team merge on
 * the read path. Covered by `contacts.unit.test.ts`.
 */
export function resolveProgressReportContacts(
  teamContacts: ProgressReportContact[],
  storedContacts: ProgressReportContact[],
): ProgressReportContact[] {
  if (storedContacts.length > 0) {
    return storedContacts;
  }
  return mergeProgressReportContacts(teamContacts, []);
}
