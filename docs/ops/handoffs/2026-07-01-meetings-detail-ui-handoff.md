# Handoff: Meetings Detail UI Port (Tasks 12 + 13A)

**For:** the dedicated UI worker (isolated worktree, branch `feat/meetings-detail-ui` cut from `feat/meetings-tool`)
**From:** the orchestrating session executing `docs/superpowers/plans/2026-07-01-meetings-tool.md`
**Date:** 2026-07-02

## Mission

Build the meeting detail experience: Task 12 (detail page shell, tabs, header, convert CTA, inline fields, attendees, attachments) and Task 13A (transcript + AI summary panes, ported behaviorally from Meetily). Read the plan's Task 12 and Task 13A sections — they are the requirements. Read the plan's "Meetily adoption strategy" section and follow it exactly (borrow behavior, rebuild on Alleato primitives, MIT attribution for copied code, never import Tauri/desktop patterns).

## Ground rules

- Work ONLY in your own worktree on `feat/meetings-detail-ui`. Merge back into `feat/meetings-tool` (never main) when browser-verified.
- Invoke `Skill("alleato-detail-page")` before any detail-page JSX. All Alleato UI gates apply (no raw grids/colors/borders; `DetailLayout`, `EditableDetailField`, `SectionRuleHeading`/`SectionAction`, `EmptyState`; empty field renders nothing).
- You do NOT own: Supabase schema, API payloads, route handlers, the Fireflies pipeline, `frontend/src/hooks/use-meetings.ts` (consume it; if a hook is missing/wrong, report back — don't fork it), or full-project verification.
- The Meetily donor clone is at `/Users/meganharrison/Documents/reference/meetily` (read-only). Donor surfaces: `frontend/src/components/MeetingDetails/TranscriptPanel.tsx`, `SummaryPanel.tsx`, `frontend/src/components/VirtualizedTranscriptView.tsx`, `EditableTitle.tsx`, `frontend/src/components/AISummary/BlockNoteSummaryView.tsx`, `frontend/src/hooks/meeting-details/useMeetingData.ts`.
- Never commit `frontend/package-lock.json`; leave `pnpm-lock.yaml`/`pnpm-workspace.yaml` alone.

## Files you own

- `frontend/src/app/(main)/[projectId]/meetings/[meetingId]/page.tsx` (rewrite)
- `frontend/src/components/domain/meetings/meeting-detail-header.tsx` (extract if page >400 lines)
- `frontend/src/components/domain/meetings/meeting-transcript-pane.tsx` (new)
- `frontend/src/components/domain/meetings/meeting-summary-pane.tsx` (new)
- Shared transcript-virtualization/summary-editor helpers only if genuinely reusable beyond meetings

Do NOT edit: `agenda-section.tsx` / `agenda-item-row.tsx` (built by the main session as self-contained components taking `MeetingDetail` + hooks; compose them into the page when they exist — if they don't exist yet when you integrate, leave a clearly-marked slot and report), the meetings list page, create-meeting dialog.

## The data contract (source of truth: code, re-read it — do not trust this doc if they diverge)

- `MeetingDetail` type: `frontend/src/lib/meetings/server.ts` (meeting row + derived `status: "draft"|"awaiting_minutes"|"minutes"`, attendees with person names, categories→items with server-computed `agenda_number` + `task_count`).
- Hooks: `frontend/src/hooks/use-meetings.ts` — `useMeetingDetail(projectId, meetingId)`, `useUpdateMeeting`, `useConvertMeeting` ({mode: "minutes"|"agenda"}; converting to minutes clears draft), `useCreateFollowUpMeeting`, `useDeleteMeeting`, plus agenda hooks consumed by the agenda components. Cache keys are project-scoped: `meetingKeys.detail(projectId, meetingId)` — never hand-build keys.
- Transcript: `meeting.transcript_document_id` (TEXT, `document_metadata.id`) — the Transcript tab renders only when set. Existing transcript viewer to reuse/port around: `frontend/src/components/meetings/meeting-detail-content.tsx`. Prep/summary data: existing `/prep` + `/digest` endpoints under `/api/projects/[projectId]/meetings/[meetingId]/` (they accept the meetings-table UUID and resolve to the transcript internally; 404 with a clear message when no transcript is linked).
- Attachments: `DocumentPicker`/`LinkedDocumentsList` with entity `meeting` — if `meeting`/`meeting_item` are not yet registered in `frontend/src/lib/documents/pattern-c-attachments.ts`, registering them IS in your scope (junction tables `meeting_documents`/`meeting_item_documents` already exist with RLS).

## Definition of done (per handoff-requirements in the plan)

Report back with: changed files; which Meetily files were ported vs referenced; copied-vs-rewritten inventory + attribution notes added; unresolved integration assumptions; browser evidence (screenshots of: detail page fields inline-editing, convert→revert flip, transcript pane on a meeting with a real transcript — project 67 has backfilled ones, summary pane loading prep content) or the exact blocker. Dev server: port 3001, auth pre-configured (`TEST_USER_1` in .env — never ask the user to log in).
