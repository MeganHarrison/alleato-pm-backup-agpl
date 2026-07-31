# Write id-shape contract — which user id each "who did this" column wants

**Read this before writing an actor id (`created_by`, `submitted_by`, `reviewed_by`,
`assigned_by`, `updated_by`, `author_id`, `approved_by`, `uploaded_by`, …) into any table.**

Verified 2026-07-10 against `frontend/src/types/database.types.ts` Relationships.

## The two ids

- **auth uid** — `getApiRouteUser().id` (the JWT `sub`). This is ALSO `user_profiles.id`
  (every route reads the profile via `.eq("id", authUser.id)`), so they are the same value.
- **`people.id`** — a SEPARATE id, resolved from the auth uid via
  `users_auth.auth_user_id → person_id`. Get it with `resolvePersonId(user)` from
  `@/lib/auth/identity` (or `membership.personId` when you already ran `verifyProjectAccess`).

Using the wrong shape in an FK column makes the write fail or the row get RLS-hidden —
silently, because most actor columns have no FK to catch it.

## Rule

The correct id is a per-`{table, column}` fact. **Column name alone is ambiguous** — the
same name means opposite shapes across tables:

| Column name | Wants `people.id` in | Wants auth uid in |
|-------------|----------------------|-------------------|
| `submitted_by` | subcontractor_sov_submissions | submittals, submittal_revisions |
| `reviewed_by` | subcontractor_sov_submissions, project_report_suggestions | ai_learning_promotions, document_attribution_candidates, source_signal_candidates |
| `assigned_by` | project_role_members | tasks |

So look up the specific table+column below before stamping.

## Columns with a real FK (the DB enforces these)

**FK → `user_profiles.id` (stamp the auth uid, `user.id`):**
- admin_feedback_assistant_threads.created_by
- admin_feedback_comments.author_id
- admin_feedback_items.created_by
- idea_items.created_by
- training_doc_assets.created_by, training_doc_relations.created_by,
  training_doc_steps.created_by, training_docs.created_by / updated_by

**FK → `people.id` (stamp `resolvePersonId(user)` / `membership.personId`) — the danger set:**
- subcontractor_sov_submissions.submitted_by / reviewed_by  *(the one route that stamps it — correct today)*
- project_role_members.assigned_by  *(not currently actor-stamped)*
- project_vendors.added_by  *(insert omits it — null today)*
- project_report_suggestions.reviewed_by  *(no API writer)*
- user_schedule_notifications.resource_tasks_assigned_to_id  *(filled from a chosen person, not the actor)*

## Everything else: unconstrained free text

The ~95 other `created_by` / `updated_by` / `changed_by` / `actor_id` / `approved_by` /
`uploaded_by` sites write into columns with **no FK**. They all hold the **auth uid**
today (e.g. change_events even round-trips it: it looks the creator back up via
`users_auth.eq("auth_user_id", changeEvent.created_by)`). Keep stamping the auth uid there
for consistency — but the DB will NOT catch a wrong id, so treat the FK→`people` set above
as the only place a wrong shape is fatal.

## Status (2026-07-10)

**Zero live mismatches.** No route stamps an auth uid into an FK→`people` column, nor a
`people.id` into an FK→`user_profiles` column. But that safety is **incidental** (the
FK→`people` columns happen to be null or user-supplied), not enforced — one careless
`added_by: user.id` on `project_vendors` is a silently-hidden row.

## Related

- Resolver + identity graph: `frontend/src/lib/auth/identity.ts`, CONTEXT.md → "Identity resolution".
- Hand-rolled forward walks (`api/commitments/route.ts`, `api/auth/admin-check/route.ts`,
  `api/projects/route.ts` ×2, the two `directory/people/[personId]/*-notifications` routes)
  are all **read-only person-id lookups inside GET handlers** — do NOT blindly swap them to
  `resolvePersonId`. That resolver has a write side effect (backfills `users_auth` /
  auto-provisions a `people` row), which is wrong on a GET, and `admin-check` specifically
  *reports* `hasPersonLink`, which auto-provisioning would defeat. Consolidating them safely
  needs a read-only `lookupPersonId` variant (users_auth → people fallback, no provision)
  plus per-route judgment — a deliberate follow-up, not a mechanical swap.
