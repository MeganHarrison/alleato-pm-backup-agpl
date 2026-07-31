# Project Intelligence Runbook

**Use for:** morning-run monitoring, a missing report, source-coverage concerns,
recovery, and production verification.  
**Architecture:** [`docs/architecture/PROJECT-INTELLIGENCE.md`](../architecture/PROJECT-INTELLIGENCE.md)

## Normal operation

Render cron `alleato-daily-executive-brief-0600-et` owns the weekday run. Its
schedule is `*/15 10-13 * * 1-5` UTC; the wrapper selects 06:00
America/New_York for normal execution and uses the remaining window for
recovery.

Expected outcome: one fresh, current `intelligence_packets` row for the prior
business date with `packet_json.runContract.status = completed`, a durable full
report, complete source receipts, and completed consumer read-backs. The
matching scheduler row in `ai_work_runs` is `succeeded`.

Before synthesis, the run also checks indexed SharePoint job folders. Files in
`04 - Estimate` and `05 - Proposal` provide the authoritative job number,
project name, location, folder path, and source URL for attribution. This is a
required pre-synthesis gate, not an optional troubleshooting lookup.

Backend projections share one executable:

```bash
python3 -m src.services.project_intelligence.runner domain-packets
python3 -m src.services.project_intelligence.runner project-sweep
```

Render keeps separate `alleato-domain-packet-compiler` and
`alleato-project-synthesis-sweep` schedules because their cadences differ, but
both commands must resolve through that runner. A direct cron command targeting
`src/scripts` or `src.services.intelligence` is an ownership violation.

## First checks

From the repository root:

```bash
npm run verify:executive-daily-brief-schedule
node project-intelligence/runner/run-scheduled-daily-executive-brief.mjs --force --date YYYY-MM-DD
```

The first command checks repository configuration and the live Render schedule.
The second is idempotent: if a compliant packet already exists, it reports
`canonical_packet_already_generated_for_scheduled_day` and records success
without creating a duplicate.

Use a controlled regeneration only when new compilation is intentional:

```bash
node project-intelligence/runner/run-scheduled-daily-executive-brief.mjs \
  --force --date YYYY-MM-DD --regenerate
```

## Assessing a run

```sql
select id, packet_type, freshness_status, generated_at,
       packet_json->>'businessDate' as business_date,
       packet_json->'runContract' as run_contract
from public.intelligence_packets
where packet_type = 'current'
order by generated_at desc
limit 1;
```

Confirm `completed`, a complete corpus, complete `fullContentRead` lane
receipts, zero truncation, and a `consumerReceipt` covering candidates,
project state, tasks, and progress reports.

Inspect the source manifest generated for the run and confirm:

- `sharePointAttribution.status = complete`;
- `eligibleRows`, `acceptedRows`, and `projectProfiles` are nonzero;
- every correction identifies its prior assignment, resolved assignment or
  unregistered label, reason, and SharePoint evidence links when available;
- `unresolvedConflicts` contains no source that still carries the disputed
  `projectId`;
- the source list identifies every `unverified_no_sharepoint_profile` assignment
  removed because its project had no indexed proposal/estimate profile and its
  title did not independently confirm the project.

The run must also pass the synthesis attribution checks. A project H3 may name
exactly one evidence-resolved project, and every citation inside that section
must carry the same project label in `sourceProjectIndex`. The same rule applies
to structured project blocks, actions, and calls. A model-generated combined
heading such as `Space Coast Town Center / Port Collective` is a failed run,
even when lower layers exit cleanly.

An unassigned portfolio source can appear inside one project section only when
its persisted `mentionedProjectLabels` explicitly contains that project. A
source carrying a different project label never qualifies for this exception.
Do not manufacture a mention by combining project-name tokens found in separate
parts of a message, email addresses, or related-looking threads.

For a disputed project, search the SharePoint `04 - Estimate` and
`05 - Proposal` folders first. Compare job number, project name, city/state,
proposal title, and estimate title. Similar scope—such as hotel, restaurant, or
food hall—is not identity evidence.

```sql
select id, status, attempt_count, blocker, failure_code, failure_message,
       next_attempt_at, started_at, completed_at, updated_at
from public.ai_work_runs
where workflow_id = 'executive-intelligence-daily-schedule'
  and business_date = date 'YYYY-MM-DD';
```

## Failure response

| State | Meaning | Action |
| --- | --- | --- |
| `succeeded` | Completed packet was read back. | No run action required. |
| `running` under 45 minutes | Active exclusive attempt. | Do not create another attempt. |
| `running` over 45 minutes | Stale attempt. | Next recovery-window call resumes it; investigate the stalled connector. |
| `failed_retryable` | Transient failure and retry time recorded. | Allow scheduled retry; inspect blocker and structured logs. |
| `failed_permanent` | Retry/contract failure. | Do not publish or overwrite prior report; repair then regenerate deliberately. |
| Current packet without completed run | Invalid publication state. | Treat as incident; do not present it as report of record. |
| Source lane `failed` | Incomplete corpus. | Treat as failed, never as empty; repair connector and rerun. |
| `SharePoint attribution evidence unavailable` | Proposal/estimate rows could not produce any project identity profiles. | Repair SharePoint ingestion or project linkage; do not bypass the gate. |
| `unresolved_conflict` | Source names a different development than its assigned project. | Leave it de-attributed, inspect the proposal/estimate folders, resolve the actual project or lead, then regenerate. |
| `Project attribution synthesis gate failed` or `Detailed report attribution gate failed` | Model output changed or merged evidence-resolved project identities. | Do not publish; inspect the named project/source aliases and regenerate only after the deterministic gate passes. |

Never repair a failed run by editing report text or a status flag. Corpus,
synthesis, and projection read-backs are one publication contract.

## User-facing verification

Verify these canonical routes after a production change:

1. `/daily-brief` is concise and points to the newest completed artifact.
2. `/daily-briefs/[briefId]` renders durable full markdown, not a truncated
   summary.
3. `/[projectId]/intelligence` shows controlled state, source links, packet
   timeline, governed tasks/responsibilities, reports, and recommendations.
4. The Assistant cites current/historical reports and original sources, or says
   evidence is insufficient.

Attach desktop and mobile screenshots from the canonical routes before closing a
visual, scheduled, database-backed, or integration task.

## Regression checks

Run these as coherent gates, not after every file edit. Use syntax/import checks
during implementation; run the Node gate after the Node compiler/fan-out phase,
the backend gate after the backend ownership phase, the publication gate once,
and the controlled runtime/visual gate once.

```bash
node --test \
  project-intelligence/core/__tests__/project-attribution-evidence.test.mjs \
  project-intelligence/core/__tests__/*.test.mjs \
  project-intelligence/ingestion/__tests__/*.test.mjs \
  project-intelligence/runner/__tests__/*.test.mjs \
  project-intelligence/projections/__tests__/*.test.mjs

(cd backend && RAG_DATABASE_URL='' .venv/bin/python -m pytest -q \
  tests/test_product_intelligence_packets.py \
  tests/test_project_intelligence_targets.py \
  tests/test_project_intelligence_validation.py \
  tests/test_project_intelligence_signal_candidates.py \
  tests/test_project_intelligence_timeline_projection.py \
  tests/test_project_intelligence_report_suggestions.py \
  tests/test_project_intelligence_operating_record.py \
  tests/test_project_intelligence_runner.py)

(cd frontend && npx jest --runInBand \
  src/lib/daily-briefs/__tests__/daily-deep-read-promotion.test.ts \
  src/lib/daily-briefs/__tests__/admin-history.test.ts \
  src/lib/daily-briefs/__tests__/source-links.test.ts)
```

Use `backend/.venv/bin/python`, not macOS `/usr/bin/python3`; the system Python
is 3.9 and cannot import the backend's modern type syntax.

Apply and verify only an owned migration; do not push an unrelated migration
queue:

```bash
npm run db:migrations:verify-applied -- supabase/migrations/<migration>.sql
```

## Follow-up hardening

The scheduler has durable retries and safe recovery. A provider can still stall
before the compiler-wide timeout, so the next hardening slice should add
per-connector timeout and cancellation telemetry while preserving the existing
failure-loudly and prior-report-preservation contract.
