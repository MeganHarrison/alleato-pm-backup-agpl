# CRM Daily Action Workspace

Task ID: CRM-DAILY-ACTIONS
Delivery lane: Standard
Verification contract: Optional

## Objective

Give business-development users one daily workspace for CRM calls, emails,
meetings, and follow-ups while retaining the existing Tasks system as the
system of record.

## Scope

- Add a CRM Actions route that filters the existing task inbox to CRM-linked
  tasks.
- Keep completion, assignment, due date, priority, and task detail behavior in
  the existing Tasks workflow.
- Add deterministic pipeline warnings for overdue expected-close dates, deals
  without a future action, and deals that have not changed within the configured
  stale-deal threshold.
- Reuse the current CRM follow-up creation workflow from account and deal
  context; do not add a second generic CRM-task creation path.

## Acceptance criteria

- [ ] `/crm/tasks` appears in CRM navigation and loads CRM-linked tasks only.
- [ ] My Tasks and All Tasks permissions remain unchanged.
- [ ] Users can complete and edit CRM tasks with the existing Tasks controls.
- [ ] Open pipeline cards explain overdue close, no-next-action, and stale-deal
      conditions without affecting won or lost deals.
- [ ] CRM workspace and attention APIs expose the data needed by the UI.
- [ ] Focused unit/component tests pass.
- [ ] Authenticated desktop and mobile screenshots are reviewed.

## Out of scope

- Outlook mailbox or calendar synchronization.
- Automatic AI-generated activity or tasks.
- New database tables or migrations.
- Changes to the generic task-creation contract.

## Verification evidence

- Focused Jest: 4 suites, 20 tests passed (`rules`, `local-store`,
  `pipeline-review`, and `tasks-inbox-crm-context`).
- Targeted ESLint: passed with zero warnings or errors on the release files.
- Changed-file type-debt guard: passed with no new `any` debt.
- CRM-scoped TypeScript check: the release files passed; the command remains
  non-green because of the pre-existing
  `src/components/ai-chat/sheet-editor.tsx:148` error.
- Full frontend TypeScript check: non-green with pre-existing workspace errors;
  the one scoped CRM error it exposed was fixed before closeout.
- Independent review: timezone boundary, invalid timezone, expiring test clock,
  non-CRM deep links, overnight refresh, and mobile tab reachability findings
  were corrected. No unresolved critical or high finding remains.
- Local authenticated screenshot: blocked because this checkout has no local
  Supabase environment file. Production desktop/mobile validation is required
  immediately after the Git-triggered deployment becomes ready.
