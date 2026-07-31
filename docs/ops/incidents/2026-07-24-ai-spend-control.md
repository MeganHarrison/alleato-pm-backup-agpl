# Incident: Unbounded and Incomplete AI Spend Accounting

Date: 2026-07-24
Severity: High
Status: Contained; durable global metering remains open

## Impact

- The RAG ledger recorded `$122.255819` in estimated model spend from
  2026-06-17 through the incident investigation.
- The 2026-07-22 snapshot was `$98.867721`, matching the reported `$100`
  depletion.
- On 2026-07-24 alone, the ledger recorded approximately `$17.31`.
- The internal total is a lower bound because multiple production callsites do
  not write to the ledger.

## Root Cause

PM APP `document_metadata` inserts invoked a live `pg_net` pipeline URL. A large
SharePoint and Outlook ingest inserted 4,210 documents and fanned out thousands
of `/api/pipeline/process` requests. The endpoint queued background processing
without authentication, request deduplication, or a durable bounded queue.

Spend accounting was also fragmented. The product dashboards read main-chat
history, while RAG usage lived in a separate ledger and several scheduled and
interactive AI runtimes wrote nowhere.

## Detection Gap

- No canonical callsite-to-owner-to-budget registry existed.
- No check rejected unregistered provider calls.
- The database suspension verifier checked `pipeline_url` but not
  `fireflies_pipeline_url` or the trigger body.
- The pipeline budget was absent from the backend runtime, non-atomic, and
  failed open on ledger errors.
- Provider attribution defaulted to `openai` even when the gateway was used.
- Unmetered scheduled jobs could run continuously without appearing in the
  spend dashboard.

## Containment Performed

- Disabled and verified both PM APP dispatch URLs.
- Suspended and verified the unmetered Microsoft Executive Assistant and domain
  packet compiler Render crons.
- Configured and verified gateway-only routing and a `$10/day` cap on the
  backend and tracked AI crons.
- Blank-overrode the direct OpenAI credential inherited by the backend so
  legacy raw SDK calls cannot bypass gateway enforcement.
- Deployed and verified the backend runtime configuration.
- Added fail-closed ledger reads, actual-provider attribution, and Render
  runtime metadata.
- Added an executable ownership registry and a live spend report that names
  coverage gaps instead of presenting a false total.

## Prevention

Immediate guardrails are `npm run verify:ai-spend-ownership` and
`npm run ai:spend:report`. The durable prevention is an atomic
reservation/settlement ledger and a leased database outbox, followed by metered
transports for every production runtime and reconciliation to provider billing.
