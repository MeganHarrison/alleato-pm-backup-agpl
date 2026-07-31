# Task: Grant env test account access to all projects

## Status

- [x] Intake complete
- [x] Root cause verified with runtime evidence
- [x] Implementation plan defined
- [x] Helper script repaired for the current membership contract
- [x] Live access grant executed against Supabase
- [x] Verification complete and evidence recorded

## Scope

Give the test account defined in the local env file active access to every current project using the real `project_directory_memberships` contract. Replace the stale helper path so the repo has a durable way to repeat the operation without falling back to legacy tables.

## Root Cause

- The env test account `test1@mail.com` maps to a real `people` record, but project visibility is enforced by active `project_directory_memberships`, not by app admin alone.
- The existing helper `frontend/scripts/setup-test-user-for-all-projects.ts` is stale: it targets legacy `project_members`, hardcodes an old user id, and only scans the first five projects.

## Verification Plan

- Confirm the env test account email, auth user id, and linked `person_id`.
- Count total projects and current active memberships before the change.
- Repair the helper to use `project_directory_memberships` and all current projects.
- Run the helper with service-role credentials from `frontend/.env.local`.
- Recount memberships and compare to the project count after the change.

## Evidence

- Pre-change runtime probe: `test1@mail.com` -> auth user `6ae4299f-6c21-4e99-b6a1-ccb1fe5aa7f6` -> person `34b16b53-b28c-4ff7-ae31-1bd331eba1f0`, with `117` total projects and `6` active memberships before the fix.
- Live grant run: repaired helper inserted `111` missing `project_directory_memberships` rows and reactivated `0`.
- Independent post-change read-back: `117` total projects and `117` active memberships for person `34b16b53-b28c-4ff7-ae31-1bd331eba1f0`.
