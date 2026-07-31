# Batch Work + Deep-Verify-Once Gate

**Trigger:** Every multi-step task. Read before you start editing.

## The problem this prevents

Working one micro-task at a time is slow for reasons that have nothing to do with the
code: per-task finish gates, per-task commits/pushes, restarting the dev server and
re-logging-in for every check, rebase churn from multiple sessions touching `main`, and
narrating every step. The slowness is **packaging overhead, not the edits.**

The opposite failure is just as bad: shallow "the button renders" checks that miss
contract bugs. Example that cost a full session — an AI Review button existed and
rendered, but submit failed because the write used the auth user id instead of
`people.id`, and RLS silently hid the broken workflow step. A render check passes; a real
end-to-end run as the actual user role catches it.

**These are not in tension.** Batching does not weaken verification — it moves
verification from "shallow, every step" to "deep, once per slice." The RLS/contract class
of bug is caught *better* per-slice, because a real-role end-to-end run + DB read-back is
a per-slice activity, not a per-edit one.

## The operating contract

1. **One session owns the repo.** Do not run parallel sessions against `main`. If
   parallelism is genuinely needed, each session gets its own git worktree and never
   pushes to `main` directly. This alone removes most dirty-checkout / rebase churn.

2. **Work in slices, not micro-tasks.** Group every related edit (all the files a
   coherent change touches — UI + API + types + test) into one slice. While building,
   run only **fast targeted checks** (single-file typecheck, the one relevant test).
   Do NOT commit, push, or run the full gate suite mid-slice.

3. **Run the heavy suite once per slice, and delegate it.** Full typecheck / lint /
   `npm run build` / full test suite goes to a lower-cost sub-agent (see CLAUDE.md
   "Verification Delegation"). The main thread keeps editing; it only acts on concrete
   blockers the sub-agent reports.

4. **Keep one live dev server + one authenticated session.** Reuse them across all proof
   in the slice. Never restart Next or re-login per check.

5. **Define "done" for a slice as a real end-to-end run, not a render.** A slice is done
   only when:
   - the flow was exercised **as the real user role** (not just "page loaded"),
   - the resulting **DB row was read back** and matches what the UI claimed,
   - any **RLS / FK / id-shape contract** on the write path was confirmed
     (auth id vs `people.id` / `user_profiles.id`, FK target vs dropdown source, etc.).

   This is the `verify-feature` / `form-gauntlet` standard. Use it once per slice.

6. **Report at slice boundaries and true blockers only.** No per-step narration.

## The one-line rule

**Never work one micro-task at a time. Batch every related step into a slice, verify the
whole slice end-to-end as the real user once, then commit/push/report.**

## Relationship to other gates

- The deep-verify step (#5) is how this gate satisfies the Core Principles "what would
  have caught this before production" requirement for the auth/RLS/FK bug class.
- FK id-shape contracts: see `FORM-FK-VALIDATION-GATE.md`.
- Which skill runs at each step: AI Engineering Playbook (see CLAUDE.md "How Work Gets Done").
- Heavy-check delegation: CLAUDE.md "Verification Delegation".
