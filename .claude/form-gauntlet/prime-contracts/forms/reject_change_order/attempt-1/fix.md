# Fix Report: reject_change_order — HTTP 403 Authorization Failure

## Root Cause

The `project_members` table queried in `getReviewerAccessForProject()` does not exist in the database schema. This caused the Supabase query to always return `null` for membership data, so `canReviewContractChangeOrder()` always evaluated `access.role` as `null` and returned `false`, triggering the 403 Forbidden response for all users.

**Exact wrong table/column:**
- Table queried: `project_members` (does not exist)
- Columns assumed: `project_id`, `user_id`, `role`

**Correct schema path:**
1. `people.auth_user_id` = the Supabase auth `user.id` (links auth users to `people` records)
2. `project_directory_memberships.person_id` = FK to `people.id`, filtered by `project_id`, contains a `role` column

## Files Changed

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/change-orders/reviewer-access.ts`

## What Changed

Replaced the single-step query against the nonexistent `project_members` table with a two-step lookup:

1. Query `people` table using `auth_user_id = user.id` to get the person record's `id`
2. Query `project_directory_memberships` using `person_id = person.id` and `project_id = _projectId` to get the `role`

If either lookup returns no result, `role` remains `null` and access is denied (correct behavior for users not on the project). If a membership row exists with any non-null role value, `canReviewContractChangeOrder()` returns `true`, allowing the user to reject the change order.

## Why This Fix Addresses the Issue

The `canReviewContractChangeOrder()` function logic was already correct — it allows any user with a non-null role to review. The only failure was the membership lookup always returning `null`. By using the real tables (`people` + `project_directory_memberships`), the test user `test1@mail.com` will now resolve to their `people` record via `auth_user_id`, then find their membership on project 67, and receive a non-null `role` value, unblocking the rejection flow.

## TypeScript Compile Check

No errors in the changed file. Pre-existing unrelated errors exist in admin pages (`crawled_pages`, `site-map`) but those are not affected by this change.

## Edge Cases and Follow-on Concerns

1. **User not in `people` table:** If an auth user has no corresponding `people` record (e.g., a brand-new user who has never been added to the directory), the lookup returns `null` for `person` and access is denied. This is the correct secure behavior.

2. **User in `people` but not on this project:** The `project_directory_memberships` query will return `null` for membership, keeping `role = null` and blocking access. Also correct.

3. **`role` column nullable:** The `project_directory_memberships.role` column is typed as `string | null`. If a membership record exists but `role` is null, `canReviewContractChangeOrder()` will return `false`. This could block a user who is listed as a project member but has no role assigned. If this is a concern, the logic could be changed to check for membership existence rather than role presence — but that is a product decision, not a bug fix.

4. **Two DB round trips:** The fix adds one additional query (people lookup) compared to a single-join approach. Performance impact is negligible for this use case (single-row lookups). A future optimization could join the two tables in one query.
