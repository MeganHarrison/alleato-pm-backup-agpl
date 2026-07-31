# Task: Meeting Source Segment Anchors

Status: Complete
Owner: Codex
Created: 2026-07-03
Linear Issue: Blocked - connector exposes comments only, not issue creation
Linear URL: N/A
Related Handoff: N/A

## Objective

Make AI meeting prep transcript-topic source links land on the exact source segment so the meeting owner can verify why an agenda suggestion exists without manually hunting through the transcript.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Doctrine Gate

Surface: Create meeting prep source links and source document meeting-topic section
One purpose: let the meeting owner verify the evidence behind a suggested agenda item.
Primary user job: open a suggestion source and land on the exact transcript topic.
Primary action: open the source link from the prep suggestion.
Secondary actions: open the meeting detail from the source page; continue reading source content.
Next action after success: decide whether to keep, remove, or edit the agenda suggestion.
Correction path: remove the suggestion before create; edit the created agenda row after create.
Keyboard path: source links remain tab reachable; hash anchors do not add keyboard traps.
Information that belongs elsewhere: full project intelligence history, all meeting analytics, unrelated tasks.
Blessed pattern: existing source detail page and compact meeting topic list; no new panels/cards.
Complexity budget: pass if the source page adds only the evidence needed for exact transcript landing.
Pass/fail: Pass.

## Acceptance Criteria

- [x] Prep transcript-topic suggestions include stable segment hash links.
- [x] Source document detail exposes matching segment anchors for meeting sources.
- [x] Meeting detail discussion topics expose the same anchors for direct project links.
- [x] Seeded agenda source descriptions preserve the anchored source URL.
- [x] Existing source links still work when no segment anchor is available.
- [x] Browser verification proves a transcript-topic source opens to a segment anchor.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database types/schema checked before adding the segment query.
- [x] Existing source detail and meeting detail patterns are reused.
- [x] No transcript payloads are added to the create meeting API response.
- [x] No new cards, metrics, or page-level bordered wrappers are introduced.
- [x] Failure path keeps meeting creation available.

## Planned Files

- `docs/ops/tasks/2026-07-03-meeting-source-segment-anchors.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/features/documents/source-document-detail.tsx`
- `frontend/src/components/meetings/meeting-detail-content.tsx`

## Integration Checklist

- [x] Focused ESLint passes.
- [x] Focused changed-file type guard passes.
- [x] Surface complexity audit passes or unavailable command is documented.
- [x] Browser verification runs on `/760/meetings/new`.

## Regression Guardrails

- [x] No duplicate primary CTA.
- [x] No nested cards or page-level bordered wrapper shells.
- [x] Anchors are stable across source detail and meeting detail pages.
- [x] AI failure does not block manual meeting creation.
- [x] Created test meetings are cleaned up after browser verification.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Design doctrine gate | `.agents/skills/alleato-design-doctrine/SKILL.md` and required references | Pass | Product constitution, workflow gate, surface budgets, blessed patterns, and pattern operating model loaded. |
| Supabase type gate | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > /tmp/alleato-db-types-current.ts`; `rg "meeting_segments:" /tmp/alleato-db-types-current.ts frontend/src/types/database.types.ts` | Pass | Fresh remote types and local generated types both include `meeting_segments.id`, `metadata_id`, `title`, `summary`, and `segment_index`. |
| Implementation pass | `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`, `frontend/src/features/documents/source-document-detail.tsx`, `frontend/src/components/meetings/meeting-detail-content.tsx` | Pass | Added stable `meeting-segment-*` anchors and anchored transcript-topic source URLs. |
| Focused ESLint | `cd frontend && ./node_modules/.bin/eslint 'src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts' 'src/features/documents/source-document-detail.tsx' 'src/components/meetings/meeting-detail-content.tsx'` | Pass | No lint failures. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Whitespace check | `git diff --check -- <task-owned files>` | Pass | No whitespace errors. |
| Surface audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/features/documents/source-document-detail.tsx frontend/src/components/meetings/meeting-detail-content.tsx` | Pass | Surface complexity audit passed for both changed UI files. |
| Clean worktree checks | `/tmp/alleato-meeting-source-anchors-publish.Z6C6cY`; focused ESLint, `npm run typecheck:changed`, surface audit, and `git diff --check` | Pass | Re-ran verification from the publish worktree based on `origin/main` at `df5275472`. |
| Prep endpoint proof | Browser-authenticated `fetch('/api/projects/760/meetings/prep-suggestions', { method: 'POST' })` | Pass | Returned transcript topic source URL `/760/intelligence/sources/01KT9P1ANSMC358GGXTAPZA2MZ#meeting-segment-d6027e78-a1f8-4105-86bc-4ae41acb8b0d`. |
| Source anchor proof | In-app browser opened `/760/intelligence/sources/01KT9P1ANSMC358GGXTAPZA2MZ#meeting-segment-d6027e78-a1f8-4105-86bc-4ae41acb8b0d` | Pass | DOM contained matching anchor, hash stayed in URL, target text began `Initial Check-in and Updates`, and target top was 96px. Screenshot: `/tmp/alleato-meeting-source-anchors/in-app-source-segment-anchor.png`. |
| Source loader proof | `cd frontend && npx tsx -e "<loadSourceDocumentDetail verification>"` with local env loaded | Pass | Source detail loader returned 7 segments and the targeted anchor id `meeting-segment-d6027e78-a1f8-4105-86bc-4ae41acb8b0d`. |
| Seeded agenda proof | Browser-authenticated create/seed/delete verification on `/760/meetings/new` | Pass | Temporary meeting `a0af2633-9ed5-40a2-8866-f0246eb29f91` seeded item `16ad365e-2848-4586-ae6d-2bac843db54c` with anchored source line, then DELETE completed. |
| Test meeting cleanup | `GET /api/projects/760/meetings/a0af2633-9ed5-40a2-8866-f0246eb29f91` | Pass | Follow-up GET returned 404 `Meeting not found.` |

## Files Changed

- `docs/ops/tasks/2026-07-03-meeting-source-segment-anchors.md`
- `frontend/src/app/api/projects/[projectId]/meetings/prep-suggestions/route.ts`
- `frontend/src/features/documents/source-document-detail.tsx`
- `frontend/src/components/meetings/meeting-detail-content.tsx`
