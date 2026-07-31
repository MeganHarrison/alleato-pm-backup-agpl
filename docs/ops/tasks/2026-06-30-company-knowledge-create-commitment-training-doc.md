# Task: Company knowledge create commitment training doc

Status: Blocked/Partial
Owner: Codex
Created: 2026-06-30
Linear Issue: Not created - available Linear connector exposes comments only, not issue creation.

## Objective

Make the "Create a Commitment" training document appear on the real company
knowledge page at `/knowledge/company`.

## Scope Checklist

- [x] Confirmed requested destination is `/knowledge/company`, not the external docs site.
- [x] Confirmed `/knowledge/company` renders `KnowledgeBasePage`.
- [x] Confirmed `KnowledgeBasePage` reads `/api/knowledge`.
- [x] Confirmed `/api/knowledge` reads `document_metadata` rows with `category='knowledge'`.
- [x] Confirmed public rows must use status `embedded`, `extracted`, or `complete`.

## Implementation Checklist

- [x] Create the training document file in the knowledge storage path.
- [x] Upsert a `document_metadata` row for the training document.
- [x] Use a category tag that appears under the company knowledge topics.
- [x] Keep the change idempotent so reruns update the same knowledge row.

## Verification Checklist

- [x] Storage upload/read-back succeeds.
- [x] `document_metadata` read-back proves the row matches `/knowledge/company` filters.
- [x] Signed URL generation path is available for the document.
- [x] Browser proof for `/knowledge/company` is attempted or blocker is recorded.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/source trace | `sed`/`rg` on `/knowledge/company`, `KnowledgeBasePage`, `/api/knowledge` | Pass | Real page reads `document_metadata`, not docs-site MDX. |
| Storage upload attempt | Supabase Storage upload as `text/html; charset=utf-8`, then `text/html` | Failed | Bucket rejects HTML MIME types. Corrected by generating/uploading a PDF. |
| Storage read-back | Supabase Storage list for `knowledge/6ddf4eba-35a4-4e31-a53e-5c8518fbcb01` | Pass | `create-a-commitment-training.pdf`, size `818428`, MIME `application/pdf`. |
| DB read-back | Supabase `document_metadata` query with `category='knowledge'`, public status filter, title match | Pass | Row `6ddf4eba-35a4-4e31-a53e-5c8518fbcb01`, title `Create a Commitment`, status `complete`, tags `Project Management,Training Docs,Commitments`. |
| Signed URL | Supabase Storage `createSignedUrl` for the PDF path | Pass | Signed URL was generated successfully. |
| Browser proof | Local browser/auth attempt from prior capture run | Blocked | UI login stuck at `Signing in...`; Playwright auth setup failed at `Supabase admin listUsers` after 30 seconds. Data path is verified; visual route proof remains blocked by auth. |

## Failure / Prevention

- Cause: The first pass put the article in the Alleato OS docs site, which is
  not the requested page.
- Detection gap: The final answer returned a constructed docs-site URL without
  verifying the requested `/knowledge/company` surface.
- Prevention: This task closes only after read-back through the same
  `document_metadata` filters used by `/knowledge/company`.

## Final Status

- Data/source update is complete.
- Browser visual proof is blocked by auth/Supabase timeout, not by the knowledge row.
- The actual user-facing route is `https://projects.alleatogroup.com/knowledge/company`; search or browse Project Management for `Create a Commitment`.
