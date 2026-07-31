/**
 * Email access filtering.
 *
 * Non-admin users may only see emails they are a party to: messages where they
 * are the sender, recipient (to/cc/bcc), the owner of the synced mailbox, or
 * the app user that created an in-app email (drafts, app-sent messages).
 *
 * The returned string is suitable for `PostgrestFilterBuilder.or(...)` on the
 * `project_emails` table. Returns `null` if we have no identifier to match
 * against — callers should short-circuit to an empty result rather than leak
 * data.
 */
export interface OwnEmailsFilterInput {
  authUserId: string | null | undefined;
  email: string | null | undefined;
}

// PostgREST `or` parses on commas and parens. `cs.{value}` for array-contains
// breaks if `value` contains `,`, `}`, `"`, `\`, or whitespace. Emails are
// unlikely to contain those, but reject any that do so we never build a
// malformed filter that might match unintended rows.
function isSafeEmail(value: string): boolean {
  return /^[^\s,"\\(){}]+@[^\s,"\\(){}]+$/.test(value);
}

export function buildOwnEmailsFilter(input: OwnEmailsFilterInput): string | null {
  const clauses: string[] = [];
  const email = input.email?.trim().toLowerCase();

  if (email && isSafeEmail(email)) {
    clauses.push(`from_email.ilike.${email}`);
    clauses.push(`mailbox_user_id.ilike.${email}`);
    clauses.push(`to_list.cs.{${email}}`);
    clauses.push(`cc_list.cs.{${email}}`);
    clauses.push(`bcc_list.cs.{${email}}`);
  }

  if (input.authUserId) {
    clauses.push(`created_by.eq.${input.authUserId}`);
  }

  if (clauses.length === 0) {
    return null;
  }

  return clauses.join(",");
}
