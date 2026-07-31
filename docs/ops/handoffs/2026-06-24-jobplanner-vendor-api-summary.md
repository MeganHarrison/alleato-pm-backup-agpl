# Job Planner Vendor API Summary

Date: June 24, 2026
Project in question: Vermillion Rise Warehouse
Job Planner project ID: `5296`
Alleato project ID: `67`

## Owner-facing summary

We were able to sync the Vermillion submittal log and drawing log into Alleato, but we were not able to access the underlying submittal documents through the Job Planner API or the reachable authenticated web surfaces.

What works today:

- Submittal metadata is readable from the API and has already been synced into Alleato.
- Drawing metadata is readable from the API and has already been synced into Alleato.
- Drawing PDFs are directly downloadable from the API by drawing GUID.

What does not work today:

- Submittal attachment/document endpoints do not expose Vermillion submittal files through the API surface we can reach.
- The fallback project attachment tree does not contain a trustworthy submittal package library for Vermillion; it is mostly daily-report photos plus one unrelated bid PDF branch.

Current request to vendor:

- Confirm whether there is an API or authenticated web endpoint that exposes submittal attachments/documents for project `5296`.
- Confirm what authentication method is required for that endpoint.
- Confirm whether submittal attachments are expected to be returned from `GET /submittals/{submittalId}` or a related route.

## Exact live findings

### 1. Project identity and sync state

- `GET https://api.jobplanner.com/projects` returned the Vermillion project.
- `GET https://api.jobplanner.com/projects/5296/submittals` returned `143` submittal records.
- Those `143` submittals were imported into Alleato project `67`.
- A rerun of the importer showed `0` inserts and `143` updates, confirming idempotent sync behavior for the submittal log.

### 2. Working submittal metadata surfaces

The following endpoint worked with the Job Planner API key:

- `GET /projects/5296/submittals`

Observed behavior:

- Returned `143` submittal rows.
- Included useful metadata such as `submittalId`, `submittalNumber`, `title`, `itemTypes`, manager info, and ball-in-court data.
- For Vermillion, the list rows surfaced `folderId = 0`.

We also verified a detail-style submittal read was reachable on the API surface, but the document data was not useful:

- `GET /submittals/{submittalId}`

Observed behavior across Vermillion:

- `attachments` came back empty.
- No usable folder linkage was exposed for the related files.

### 3. Failing submittal document surfaces

The following surfaces did not yield submittal documents for Vermillion:

- `GET /submittals/{submittalId}/attachments`
- direct browser-triggered requests to the same attachment route
- browser-side replay of Job Planner’s own signed headers against the same route

Observed behavior:

- The route returned `401` even when replaying the same browser-generated headers used by the Job Planner web app, including `AccessKey`, `SessionId`, `Perm`, `ProjectPerm`, `PortalId`, and `ProjectId`.
- Adding the access key in the query string did not resolve the `401`.

Conclusion:

- This is not a simple missing-header issue on our side.
- The currently reachable access-key session and public API-key session do not authorize submittal attachments for Vermillion.

### 4. Working drawings surfaces

The following drawing surfaces worked with the Job Planner API key:

- `GET /projects/5296/drawings/areas`
- `GET /projects/5296/drawings/settings`
- `GET /projects/5296/versions`
- `GET /drawings/{guid}/download`
- `GET /drawings/{guid}/thumbnail`

Observed behavior:

- `GET /projects/5296/versions` returned `3` real drawing versions plus Job Planner’s synthetic current-set view.
- Across the real versions, Vermillion exposed `60` unique drawing numbers and `109` drawing revisions.
- Drawing PDFs were directly downloadable from `GET /drawings/{guid}/download`.

This was sufficient for us to build and verify a working drawing sync into Alleato.

### 5. Reachable project attachments fallback did not solve submittal documents

The project attachments surface was reachable:

- `GET /projects/5296/attachments`

Observed behavior from the live audit:

- `94` total reachable entries
- `7` folders
- `87` files
- file mix: `86` JPG files and `1` PDF
- root structure: `Private`, `Shared`
- only submittal-like folder name found: `Bid Submittal`
- that branch contained only:
  - `Private / Bid Submittal / Enviro-Max, Inc`
  - one vendor schedule PDF underneath

We also ran a name-based fallback audit across submittal numbers/titles versus reachable attachment names.

Observed behavior:

- matches were low-confidence and noisy
- most “hits” were false positives caused by date-stamped photo filenames containing digits that overlapped submittal numbers
- no trustworthy submittal-package naming pattern was present

Conclusion:

- The reachable project attachment tree is not a reliable source for Vermillion submittal documents.
- Automating a document import from that fallback surface would be unsafe.

## What we need from Job Planner

Please confirm one of the following:

1. The correct API endpoint for submittal attachments/documents for project `5296`.
2. The required authentication mode for that endpoint.
3. Whether submittal attachments are intentionally excluded from the API key surface.
4. Whether a different token, session type, user permission, or partner API is required.
5. Whether there is an export path that includes both submittal metadata and the underlying documents in a machine-readable way.

## Current operational outcome

As of June 24, 2026:

- Alleato can sync Vermillion submittal metadata.
- Alleato can sync Vermillion drawings and drawing revisions.
- Alleato cannot currently sync Vermillion submittal documents from the Job Planner surfaces we can reach.

## Internal evidence references

- Submittal sync task: `docs/ops/tasks/2026-06-24-jobplanner-vermillion-submittals-import.md`
- Drawing sync task: `docs/ops/tasks/2026-06-24-jobplanner-vermillion-drawings-sync.md`
- Submittal document fallback audit: `docs/ops/tasks/2026-06-24-jobplanner-vermillion-submittal-docs-audit.md`
