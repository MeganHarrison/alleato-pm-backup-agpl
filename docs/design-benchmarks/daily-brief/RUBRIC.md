# Daily Brief Candidate Rubric

Score each candidate independently. A strong visual treatment cannot compensate
for a missing action path or unsupported claim.

| Dimension | Weight | Pass evidence |
| --- | ---: | --- |
| Decision-first hierarchy | 20 | Five-second reviewer identifies the top decision, consequence, and next action. |
| Action completion | 20 | Top decision opens a real record/detail and reaches a supported progress, assignment, or escalation action. |
| Evidence confidence | 15 | Source/canonical link is adjacent to the decision but secondary to the action. |
| Information discipline | 15 | Tier 3 information is hidden/demoted; no KPI row, duplicated summary, or decorative container survives. |
| Workflow continuity | 10 | Open detail, act or inspect, and return to the queue without losing place. |
| Responsive and keyboard usability | 10 | 390px has no horizontal overflow or hover-only action; focus order reaches the key action. |
| Design-system and accessibility fit | 10 | Reuses existing primitives, visible focus, semantic labels, WCAG-compatible tokens, and no silent failure. |

## Automatic failures

- No real next action for a displayed decision.
- Made-up owner, due date, amount, evidence, or capability.
- The decision queue is visually secondary to summary/KPI/dashboard chrome.
- A screenshot is captured from `/auth/login`, an error boundary, or a route
  different from the candidate fixture.
- Desktop-only, hover-only, or keyboard-inaccessible action path.
- Candidate changes the canonical route directly outside its isolated worktree.

## Required evaluator transcript

For every candidate, record:

1. Five-second scan: Where am I? What needs attention? What can I do next?
2. Open the top decision.
3. Inspect its evidence/canonical record.
4. Take a supported action or reach its canonical action path.
5. Return to the decision queue.
6. Repeat steps 1-5 at 390px and with keyboard navigation for the primary path.

## Promotion rule

A candidate requires at least 80/100, no automatic failure, inspected desktop
and mobile screenshots, and explicit acceptance. The winner is transplanted to
the canonical route only after selection; all losing worktrees are retained as
comparison evidence and never merged.
