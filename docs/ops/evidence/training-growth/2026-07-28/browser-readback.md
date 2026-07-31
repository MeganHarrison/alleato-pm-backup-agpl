# Training Growth production readback

Date: 2026-07-28
Route: `https://projects.alleatogroup.com/training/growth`
Identity: repository-managed Playwright test user

## Production flow

1. Loaded the authenticated Project Engineer assessment.
2. Entered eight distinct current/target score pairs, evidence, and four
   complete focus plans.
3. Removed one required focus-plan value and confirmed the save action remained
   disabled.
4. Restored the value and submitted the assessment.
5. Observed `POST /api/training/growth` return HTTP 200 and the success toast.
6. Reloaded the route and confirmed:
   - exact current and target scores;
   - exact focus-plan values;
   - 30-day cadence;
   - the Jul 28, 2026 Project Engineer history row;
   - average score 59, delta +9, and eight changed skills.
7. Repeated the readback at a 390px viewport and confirmed
   `scrollWidth === clientWidth`.

The production response retained the submitted evidence inside the saved
assessment JSON, but the then-deployed history UI did not expose it. The local
fixed route now exposes saved evidence and focus-plan details through a
progressively disclosed `details` row.

## Accessibility readback

`agent-browser a11y --json` returned four rule groups. The assessment-specific
findings included five color-contrast nodes: the assessment eyebrow, muted
instruction text, and a shared notification badge. The scan also reported
duplicate/nested `main` landmark findings originating in the shared shell.

The training theme stylesheet is owned by a separate active isolated session,
so this task records rather than races that change.

## Database contract gate

No schema or migration change was made.

- CLI type generation by project ref rejected the configured legacy token.
- Type generation by database URL reached the production host but required
  Docker or Podman, which is unavailable in this environment.
- Supabase Management API type generation returned HTTP 403.
- The connected Supabase app account does not expose production project
  `lgveqfnpkxvzbnnwuled`.

This blocks the larger assessment-contract changes (universal core skills and a
user-selected two-to-four-skill focus set) until schema introspection and
migration-ledger readback are available.

## Post-deploy release proof

- Published commit: `61520a92da1b9d6d55f502ac2f88da3975da499c`
- Vercel deployment: `dpl_ujhfCX1T7YW9hXwqg8gz51FR6kiT`
- Deployment target/status: production / Ready
- Production alias: `https://projects.alleatogroup.com`

A cache-busted authenticated readback after promotion confirmed:

- “Focus next — ranked by gap” is served;
- the action is “Update check-in” for the existing same-date row;
- the “Recent check-ins” region exposes the Jul 28 row and its saved evidence,
  action, frequency, and measure;
- changing a field and selecting the Training navigation link opens
  “Discard unsaved assessment changes?” before navigation.

Artifacts:

- `15-production-post-deploy-history.png`
- `16-production-post-deploy-navigation-guard.png`
