# Production Slimming — In-Development Feature Removal

**Purpose.** Remove in-development features from **production** (the
`The-Alleato-Group/project-management` repo + production Supabase projects) so
production stays a clean, stable baseline with no half-built surfaces for other
owners to trip over. Each removed feature is **preserved intact** in the backup
(`MeganHarrison/alleato-pm-backup` repo + the backup Supabase projects) for
continued development.

This is done **one feature at a time**.

## Convention (shared across sessions)

- **Branch:** `chore/remove-inprod/<feature-slug>` off fresh `main`.
- **Commit subject:** `chore: remove <Feature> from production (preserved in backup)`.
- **PR** to `main`, ready for review (not draft) → Vercel preview → verify → merge (deploys prod).
- **Depth: code-only by default.** Delete/​unwire the feature's exclusive code;
  **leave its DB tables/columns in the production DB** (unused, and preserved in
  backup). Never drop shared infrastructure.
- **Keep shared infra.** Before deleting, classify every file/table as
  *feature-exclusive* vs *shared*. Shared code is **edited to unwire the feature's
  entry point**, never deleted. Shared tables are never dropped.
- **Preserve explicitly-kept sub-features.** When a kept feature depends on helpers
  bundled inside the removed feature, **extract** those helpers into a standalone
  module rather than deleting them.
- **Docs gates.** RAG-touching removals update `AI-RAG-ARCHITECTURE.md`; route/tool
  removals regenerate `PROJECT-MAP.md` via `npm run map:project`.

## Backup / production reference

| | Repo | PM APP Supabase | AI/RAG Supabase |
|---|---|---|---|
| **Production** (remove here) | `The-Alleato-Group/project-management` | `lgveqfnpkxvzbnnwuled` | `fqcvmfqldlewvbsuxdvz` |
| **Backup** (preserve here) | `MeganHarrison/alleato-pm-backup` | `lnnalnbmftuhiokyogsu` | `nrcsbmggcdtothvqnifr` |

## Log

### AI Submittal Review — 2026-07-24 (in progress)

Branch `chore/remove-inprod/ai-submittal-review`. Code-only.

**Deleted (feature-exclusive):**
- `frontend/src/lib/submittals/ai-review/` (schemas, review-run-service, persistence, ops-ledger, response-comment, source-references + tests)
- `frontend/src/app/api/projects/[projectId]/submittals/[submittalId]/ai-review/` (route, checks/[checkId], workflow-response + tests)
- `frontend/src/features/submittals/submittal-ai-review-panel.tsx`
- `frontend/src/lib/submittals/detail-tabs.ts` (+ test) — orphaned once the AI-review tab was removed
- `frontend/scripts/verify-submittal-ai-review.ts`, `scripts/verify/verify_submittal_ai_review_*.mjs`
- `docs/architecture/submittals-ai-review.md`
- `reviewSubmittalAgainstDrawings` tool in `frontend/src/lib/ai/tools/document-intelligence.ts`

**Edited to unwire (shared — kept alive):**
- `submittal-detail-client.tsx` — removed AI-review tab, panel mount, response-summary rendering, and tab machinery
- `hooks/use-submittals.ts` — removed the 4 AI-review hooks + `AIReviewResult`/`AIReviewDisposition` types
- `tool-registry.ts`, `assistant-action-catalog.ts`, `assistant-suggestion-resolver.ts` — removed the tool registration
- `AI-RAG-ARCHITECTURE.md` — tool count 7 → 6, canonical drawing-text reference repointed

**Extracted (to keep drawing-linking working):**
- `frontend/src/lib/submittals/linked-drawings-service.ts` — the generic
  `parseProjectId` / `getScopedSubmittal` / `getDrawingByScope` / `listLinkedDrawings`
  helpers the kept linked-drawings routes depend on.

**Kept (drawing-linking — explicitly retained):** `linked-drawings/` API routes,
`scan-drawings-sheet.tsx`, `submittal_linked_drawings` + `spec_drawing_links` tables.

**Production DB (left in place, unused, preserved in backup):**
`submittal_ai_review_runs`, `submittal_ai_review_checks`,
`submittals.ai_review_result`, `submittals.ai_review_ran_at`.

**Shared, untouched:** `ai_review_feedback`, `document_page_intelligence`,
`document_chunks`, all RAG tables.
