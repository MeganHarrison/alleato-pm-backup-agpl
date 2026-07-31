# Handoff: 2026-07-22 — SharePoint attribution evidence

## Intake Block

1) Session ID: SROOT-SHAREPOINT-ATTRIBUTION
2) Task ID: AAI-1263
3) Linear issue: AAI-1263
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1263/require-sharepoint-proposal-and-estimate-evidence-for-project
5) Current status: Complete; published to main and live on the canonical Render cron.
6) Files changed (absolute paths): See task-owned path list in the isolated-workspace registry.
7) Commands run and outcome (pass/fail counts): Focused SharePoint and synthesis-attribution contracts 29/29 PASS; independent Project Intelligence gate 96/96 PASS; learning audit 24 fingerprints PASS; source-only live run PASS; full regenerations failed closed until all model attribution errors were removed.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-22-sharepoint-attribution-evidence/`
9) Top 3 findings (frontend-visible issues first): Space Coast was published under Port; Port's authoritative SharePoint evidence says Savannah, Georgia; Union's says Union, Kentucky.
10) Recommended next action (one line): Implement and verify the SharePoint-backed pre-synthesis attribution gate.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-sharepoint-attribution-evidence.md`
12) Migration ledger evidence: N/A — no schema change.

## Linear Updates

- Kickoff comment: Issue created with the SharePoint evidence contract and Port/Union/Space Coast regressions.
- Milestone comments: SharePoint sync, source-only proof, exact source repair, and independent approval complete.
- Completion comment: Packet, source/consumer readbacks, exact main publication, and live Render revision verified.

## Current Status

The pre-synthesis compiler now enforces SharePoint proposal/estimate identity,
fails closed when evidence is unavailable or an assignment is unsupported,
preserves unregistered entity labels, and records source paths/URLs and
corrections in durable receipts. The exact Space Coast source was removed from
Port in both application and RAG databases. A first full regeneration revealed
that model synthesis could still merge corrected labels, so deterministic
detailed-report and structured-output source-to-project gates were added. The
bad packet was marked stale. Independent review approved the final exact-heading
and citation gates with no findings. Packet
`e7e55360-bfa2-455c-b012-2c7f3cb817e1` then passed the controlled run,
persisted-artifact comparison, and all downstream consumer readbacks with zero
Port Collective output.

## Exact Next Step

No implementation work remains. Observe the next normal 6:00 AM ET run through the same scheduler and packet receipts.

## Known Pitfalls

- A portfolio meeting can legitimately mention multiple projects; never reassign from incidental body text alone.
- An unregistered lead must not be silently converted into an existing project merely because both include a hotel or food-hall concept.
- Do not create a Space Coast project as part of this fix.

## Resume Commands

```bash
cd /Users/meganharrison/.codex/isolated-workspaces/sroot-sharepoint-attribution-aai-1263-aedd4c
node --test project-intelligence/core/__tests__/project-attribution-evidence.test.mjs
```

## Evidence

Evidence will be recorded in the task and `docs/ops/evidence/2026-07-22-sharepoint-attribution-evidence/`.
