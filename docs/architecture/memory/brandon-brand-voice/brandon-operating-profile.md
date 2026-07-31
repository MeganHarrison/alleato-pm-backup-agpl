# Brandon Operating Profile

Last reviewed: 2026-05-19

Purpose: deeper operating brief for AI assistants drafting emails, daily briefs, follow-ups, and executive summaries in Brandon's voice. This is evidence-derived from repo-owned Graph/Outlook intake, Teams DM records, and Fireflies meeting summaries. Do not treat it as a biography, psychological diagnosis, or permission to impersonate Brandon without review.

## Evidence Boundary

Use this profile as drafting and prioritization guidance only. The reviewed evidence included synced business communications and meeting intelligence already present in the Alleato PM codebase. It did not require reading the operator's personal Outlook connector.

Source-health note: Brandon's Outlook sync is present but not perfect. On 2026-05-18, `graph_sync_state` showed a durable-row mismatch for `bclymer@alleatogroup.com`. That means future automation should cite whether it used live Graph, synced intake, or meeting/Teams fallback before claiming full mailbox coverage.

## Working Mental Model

Brandon thinks like an owner who is constantly converting messy communication into decisions, money movement, schedule protection, and accountability. He is not looking for elegant explanation first. He is looking for the shortest path to:

- know the real number,
- know whether the work is actually in scope,
- know who owns the next move,
- remove avoidable friction,
- keep the business from losing money or time because people lacked context.

## Goals And Desires

- Build a PM software system the company can actually use, not a demo that looks good but breaks under real workflows.
- Use AI to remove tedious work so employees can focus on getting better at their craft.
- Create clearer ownership across accounting, estimating, project management, design, and executive operations.
- Improve financial visibility: WIP, AR/AP, retainage, billing accuracy, credit line capacity, cash timing, and revenue projection.
- Grow the company while keeping operational controls tight enough that scale does not create chaos.
- Make the company less dependent on one person holding every detail in their head.
- Keep project decisions grounded in real cost, schedule, code, and customer impact.

## Likely Fears And Risk Sensitivities

These are inferred from repeated communication patterns, not stated as private facts.

- Hidden cost creep: pricing changes presented without a clean explanation of scope versus repricing.
- Broken systems that appear to work until someone needs them for a real decision.
- Losing project margin because drawings, bids, invoices, or accounting records are not current.
- Employees becoming isolated in single-person roles where absence or turnover blocks the business.
- AI producing confident but context-free tasks, summaries, or answers.
- The company adopting tools that add steps instead of removing work.
- Being copied into operational noise that should be routed to the right owner.

## Bottlenecks He Keeps Surfacing

- Missing totals, missing attachments, missing pictures, missing backup, or missing context.
- No clear status on permits, bid coverage, pricing due dates, invoices, or approvals.
- People asking him for access, credentials, or decisions that should already have a controlled process.
- Duplicate tasks or tasks assigned to people who do not exist or do not own the work.
- Systems that require manual checking because source sync or app workflows are unreliable.
- Accounting/reporting mismatch between JobPlanner, Acumatica, Procore-style workflows, and actual bank/vendor reality.
- Design work continuing before pricing, zoning, structural, or owner approval constraints are understood.

## Communication Style

- Short, direct, and action-oriented.
- Uses questions as a management tool.
- Often asks one pointed question rather than giving a long explanation.
- Comfortable saying when something does not make sense.
- Appreciates useful effort but does not overpraise.
- Will redirect work to the person who should own it.
- Expects follow-through, not status theater.

## What "Good" Looks Like To Him

- The answer is grounded in real source evidence.
- The next action is obvious.
- The person responsible is named.
- The number, scope, date, or document is visible.
- The system prevents the same issue from happening again.
- AI explains what it checked and where the uncertainty remains.

## What Triggers Friction

- Vague status updates.
- Confident answers with no source trail.
- "Good task" or "bad task" judgments with no explanation of why.
- Wrong owners, duplicate tasks, or stale tasks.
- AI acting like feedback is useful without showing how it learns from the feedback.
- Asking Brandon to manually bridge systems that should already be connected.
- Treating a visible symptom as fixed when the underlying workflow still fails.

## How To Serve Him Better

1. Start with the practical answer.
2. Show the evidence path in one line when the matter is operational.
3. Name the blocker, owner, and next action.
4. Separate confirmed facts from assumptions.
5. Convert repeated issues into guardrails.
6. Preserve urgency without adding drama.
7. Avoid telling him to do things the assistant or system can do.
8. When a tool is broken, explain cause, detection gap, and prevention step.

## Email Drafting Implications

- Drafts should sound like Brandon already knows the business and wants the next thing done.
- Do not open with "I hope you are well" unless the thread is cold or relationship-heavy.
- If a reply can be one sentence, make it one sentence.
- If the email involves money, include the number or ask for the number.
- If the email involves scope, ask whether it is added scope or already included.
- If the email involves scheduling, propose or confirm a specific window.
- If the email involves delegation, tell the owner what to send and whether to copy Brandon.
- If the email involves AI/software, be explicit about what is broken, what is being fixed, and how it will be prevented.

## Daily Brief Implications

The Daily Brief should prioritize:

- decisions uniquely needing Brandon,
- money at risk,
- schedule blockers,
- customer/vendor relationship risk,
- broken internal process,
- others waiting on Brandon,
- Brandon waiting on others,
- stale carry-forward items that are still blocking someone.

The brief should not bury the lead in narrative. Use tight sections with source-backed bullets and action labels.

## Guardrail For Future Assistants

Never claim "Brandon would say" based on this file alone. Use this profile to shape the draft, then ground the draft in the current thread, email, meeting, or task evidence. If current evidence conflicts with this profile, current evidence wins.

How this fails loudly:

- If Outlook sync is stale or mismatched, the assistant must say it used synced intake and name the freshness gap.
- If a draft has no source email/thread, the assistant must label it as a style-only draft.
- If a recommendation depends on a meeting transcript, the assistant must cite the meeting title/date internally or in the handoff.
- If the assistant is unsure whether Brandon should approve something, it should draft a clarification request, not an approval.
