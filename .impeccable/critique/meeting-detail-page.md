---
target: meeting detail page (/meetings/[meetingId])
total_score: 27
p0_count: 1
p1_count: 1
date: 2026-06-11
---

# Critique — Meeting Detail Page

Score: 27/40 (Good, with sharp edges). Visual design is strong (borderless editorial
layout, Linear-grade Tasks). Dragged down by interaction-correctness issues.

## Priority issues (all fixed 2026-06-11)
- [P0] ⋯ menu item "Edit" actually opened "Assign to project", redundant with meta-bar action.
  FIX: removed ⋯ menu; meta-bar project chip is now the single canonical trigger; dialog title
  is dynamic ("Assign to project" / "Change project").
- [P1] 34 keyword pills dumped in sidebar. FIX: capped at 8 with "+N more" toggle, removed chip border.
- [P2] PageContainer + manual <h1> instead of PageShell. DEVIATED INTENTIONALLY: PageShell detail
  variant renders a large serif title that would regress the compact Superhuman/Linear header.
  Component delegates cleanly from page.tsx files so no double-header / lint violation.
- [P3] Discussion Topics left-stripe (border-l-2). FIX: replaced with numbered badge + indentation.

## Minor (fixed)
- Silent transcript-fetch failure -> added transcriptLoadFailed flag + distinct empty state.
- Misnamed hasActionItems -> hasActionSnapshot.
- Hardcoded amber/green -> text-warning / text-success tokens.
- Stray {} header artifact removed; related-meeting fallback avatar border removed.
