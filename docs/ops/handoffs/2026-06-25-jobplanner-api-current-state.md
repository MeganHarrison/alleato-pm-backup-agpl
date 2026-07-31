# Job Planner API Current State

Date: June 25, 2026
Purpose: Canonical current-state summary for future Codex sessions working on Job Planner integration.

## Read This First

If a future session needs to work on Job Planner, start here instead of re-auditing from scratch.

This document answers:

- what is already working
- what has already been synced
- which scripts are the source of truth
- which Job Planner endpoints are confirmed real
- which access surfaces are blocked
- what remains to do next

## Project Mapping

- Job Planner project: `5296`
- Job Planner project name: `25-126 Vermillion Rise Warehouse`
- Alleato project: `67`
- Alleato project name: `Vermillion Rise Warehouse`

## Current Outcome

### Already working

- Submittal metadata sync works.
- Drawing metadata sync works.
- Drawing revision sync works.
- Drawing file URLs from Job Planner are reachable and stored on revisions.

### Still blocked

- Submittal documents/attachments are not reachable from the Job Planner surfaces we have verified.

## Scripts To Use

### Smoke / discovery

- `npm run verify:jobplanner-api`

Purpose:

- verifies API-key access to the known Job Planner surfaces

### Submittal sync

- `npm run jobplanner:import-submittals -- --jp=5296 --app=67`
- dry run: `npm run jobplanner:import-submittals -- --jp=5296 --app=67 --dry-run`

Source files:

- [import-submittals.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/import-submittals.mjs)
- [import-submittals-lib.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/import-submittals-lib.mjs)
- [import-submittals.test.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/__tests__/import-submittals.test.mjs)

### Drawing sync

- `npm run jobplanner:import-drawings -- --jp=5296 --app=67`
- dry run: `npm run jobplanner:import-drawings -- --jp=5296 --app=67 --dry-run`

Source files:

- [import-drawings.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/import-drawings.mjs)
- [import-drawings-lib.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/import-drawings-lib.mjs)
- [import-drawings.test.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/__tests__/import-drawings.test.mjs)

### Submittal document fallback audit

- `npm run jobplanner:audit-submittal-docs -- --jp=5296`

Source file:

- [audit-submittal-docs-fallback.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/jobplanner/audit-submittal-docs-fallback.mjs)

## Verified Job Planner Surfaces

### API key surfaces that work

These are confirmed working with `JOBPLANNER_API_KEY`:

- `GET /projects`
- `GET /projects/5296/submittals`
- `GET /projects/5296/attachments`
- `GET /projects/5296/drawings/settings`
- `GET /projects/5296/drawings/areas`
- `GET /projects/5296/versions`
- `GET /drawings/{guid}/download`
- `GET /drawings/{guid}/thumbnail`

### API or browser surfaces that do not give usable submittal documents

These were tested and remain blocked or non-useful:

- `GET /submittals/{submittalId}`
  - returns metadata, but Vermillion detail payloads showed empty `attachments`
- `GET /submittals/{submittalId}/attachments`
  - returns `401`
- browser-side calls to the same attachment route from the authenticated access-key session
  - still `401`
- browser-side replay of Job Planner’s own signed headers
  - still `401`

Conclusion:

- submittal document access is blocked on Job Planner’s access surface, not on Alleato importer code

## What Has Already Been Synced

### Submittals

Imported into Alleato project `67`:

- `143` Job Planner submittals

Verified behavior:

- rerun dry run showed `0` inserts and `143` updates
- sync is idempotent

### Drawings

Imported into Alleato project `67`:

- `60` Job Planner drawings
- `109` Job Planner drawing revisions
- `60` current revision pointers

Verified behavior:

- rerun dry run shows no new inserts
- legacy failed-pass duplicate revisions were cleaned up
- only compact revision codes remain:
  - `JP7273`
  - `JP8572`
  - `JP8686`

## Important Implementation Details

### Drawings endpoint shape

The real drawing list endpoint is:

- `GET /projects/5296/versions`

Not:

- `GET /projects/5296/drawings`

Notes:

- `GET /projects/5296/drawings` returned `405`
- versions payload contains nested drawing records
- Job Planner also includes a synthetic current-set row with `versionId = -1`
- importer intentionally skips that synthetic row and imports only real versions

### Drawing revision mapping

Local `drawing_revisions.revision_number` is constrained to `varchar(10)`.

Because of that:

- human version names like `Revised Foundation Details` cannot be stored directly as revision numbers
- importer uses compact codes like `JP<versionId>`
- human version name is retained in set naming and revision description

### Drawing file size handling

Job Planner versions payload reported `fileSize = 0` for Vermillion drawings.

Because local schema requires `drawing_revisions.file_size > 0`:

- importer downloads each drawing once during sync
- measures real byte size from the response body
- stores that measured size on the local revision

## What The Submittal Document Fallback Audit Found

The reachable project attachment tree is not a credible submittal document source for Vermillion.

Live audit result:

- `94` total reachable entries
- `7` folders
- `87` files
- file mix:
  - `86` JPG
  - `1` PDF

The only submittal-like branch was:

- `Private / Bid Submittal / Enviro-Max, Inc`

This is not a usable project-wide submittal package library.

The name matcher also found only noisy false positives against date-stamped photo filenames.

Operational conclusion:

- do not automate submittal document import from `GET /projects/5296/attachments`

## Best Supporting Docs

If deeper detail is needed, read these next:

- [2026-06-24-jobplanner-vermillion-submittals-import.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-24-jobplanner-vermillion-submittals-import.md)
- [2026-06-24-jobplanner-vermillion-drawings-sync.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-24-jobplanner-vermillion-drawings-sync.md)
- [2026-06-24-jobplanner-vermillion-submittal-docs-audit.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-24-jobplanner-vermillion-submittal-docs-audit.md)
- [2026-06-24-jobplanner-vendor-api-summary.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-24-jobplanner-vendor-api-summary.md)

## What A Future Codex Session Should Not Re-Do

Unless new credentials or vendor guidance arrive, do not spend time re-proving:

- that `GET /projects/5296/submittals` works
- that `GET /projects/5296/versions` is the real drawing list endpoint
- that drawings can be downloaded by GUID
- that `GET /submittals/{id}/attachments` currently returns `401`
- that the reachable project attachments surface is mostly daily-report JPGs

Those points are already established.

## Best Next Steps From Here

If continuing technical work:

1. Keep using the existing submittal and drawing sync scripts.
2. Treat submittal documents as vendor-blocked unless new access is provided.
3. If vendor provides a new endpoint or auth method, test only that new surface instead of re-auditing everything else.

If continuing owner/vendor communication:

1. Use the vendor-facing summary:
   - [2026-06-24-jobplanner-vendor-api-summary.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-24-jobplanner-vendor-api-summary.md)
2. Ask specifically for the correct submittal attachment/document endpoint and auth method for project `5296`.
