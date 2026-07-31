# Handoff: 2026-07-01 — Meetings tool Meetily-derived detail UI port

## Intake Block

1) Session ID: S108
2) Task ID: AAI-866
3) Linear issue: AAI-866
4) Linear URL: https://linear.app/megankharrison/issue/AAI-866/meetings-tool-ship-detail-and-agenda-ui-on-the-new-meetings-tables
5) Current status: In Progress
6) Files changed (absolute paths):
- /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-01-S108-meetings-tool-detail-agenda-ui.md
- /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md
7) Commands run and outcome (pass/fail counts):
- kickoff pending worker execution
8) Evidence artifacts (screenshot/video/report/log paths):
- none yet
9) Top 3 findings (frontend-visible issues first):
- The structured meetings backend foundation exists, but the current detail experience does not yet exploit it.
- Meetily is a viable donor for transcript/detail/summary interaction patterns, but not for routing, storage, or shell structure.
- The detail UI should be ported as Alleato-native components, not pasted as raw Meetily markup.
10) Recommended next action (one line): Port the Meetily detail interaction layer into Alleato-native meeting detail, transcript, and summary components without changing the owned hook/API contracts.
11) Handoff file path: docs/ops/handoffs/2026-07-01-S108-meetings-tool-detail-agenda-ui.md
12) Migration ledger evidence: N/A for kickoff; reuse existing meetings migration if no new migration is added.

## Linear Updates

- Kickoff comment:
- Milestone comments:
- Completion/blocker comment:

## Current Status

Dedicated UI-session slice for the Meetily-derived frontend port on top of the
structured meetings model.

## Exact Next Step

Review the existing structured meetings detail payload and the Meetily donor
components, then implement the smallest usable Alleato-native detail shell with
transcript and summary panes.

## Known Pitfalls

- Do not break transcript-linked prep/digest access while replacing the detail route.
- Do not edit the shared list/hooks files or API payload contracts owned by `S107`.
- Do not import Tauri/local-model assumptions from Meetily.
- Keep copied code attributed if any substantial Meetily portions are ported directly.

## Resume Commands

```bash
sed -n '1,260p' '/Users/meganharrison/Documents/alleato-pm/docs/superpowers/plans/2026-07-01-meetings-tool.md'
sed -n '1,260p' '/tmp/meetily/frontend/src/components/MeetingDetails/TranscriptPanel.tsx'
sed -n '1,260p' '/tmp/meetily/frontend/src/components/MeetingDetails/SummaryPanel.tsx'
sed -n '1,260p' '/tmp/meetily/frontend/src/components/VirtualizedTranscriptView.tsx'
```

## Evidence

Kickoff scope updated for dedicated UI port session. No implementation evidence
recorded yet.

## Owned Paths

- `/Users/meganharrison/Documents/alleato-pm-wt/meetings-tool/frontend/src/app/(main)/[projectId]/meetings/[meetingId]/**`
- `/Users/meganharrison/Documents/alleato-pm-wt/meetings-tool/frontend/src/components/domain/meetings/**`
- `/Users/meganharrison/Documents/alleato-pm-wt/meetings-tool/frontend/src/components/meetings/**` only where needed to bridge existing transcript/prep surfaces

## Donor Sources

- `/tmp/meetily/frontend/src/components/MeetingDetails/TranscriptPanel.tsx`
- `/tmp/meetily/frontend/src/components/MeetingDetails/SummaryPanel.tsx`
- `/tmp/meetily/frontend/src/components/VirtualizedTranscriptView.tsx`
- `/tmp/meetily/frontend/src/components/EditableTitle.tsx`
- `/tmp/meetily/frontend/src/components/AISummary/BlockNoteSummaryView.tsx`
- `/tmp/meetily/frontend/src/hooks/meeting-details/useMeetingData.ts`
