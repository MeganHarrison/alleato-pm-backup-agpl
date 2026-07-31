# RAG Pipeline Green Plan

Date: 2026-06-30
Owner: Alleato AI operations
Status: Active

## Definition Of Green

The RAG pipeline is green only when all four gates pass:

```bash
npm run rag:verify:source-lifecycle
npm run rag:verify:meetings
npm run rag:verify:source-specific
npm run rag:verify:render-ai
```

Do not call RAG healthy if any one of those fails.

## Current Status

As of 2026-06-30 17:59 UTC:

- Source lifecycle: green.
- Meeting vectorization: green.
- Source-specific retrieval contract: green.
- Provider runway: green with warning. AI Gateway balance is `$4.8289`, below
  the `$5.00` warning floor and above the `$1.00` hard floor. Direct OpenAI is
  also configured.

## Operating Model

1. Source adapters ingest Fireflies, Outlook, Teams, and SharePoint into the
   existing app/RAG stores.
2. Vectorization writes embedded chunks to the existing `document_chunks` path.
3. Project attribution and lifecycle rows record whether sources are project
   relevant, assigned, skipped, embedded, and intelligence-ready.
4. Project Intelligence packets compile from existing evidence.
5. Source lookup and advisor answers use packet-first/source-specific paths, not
   a parallel corpus.

## Alerting Rules

- `alleato-ai-provider-health` must fail and alert on:
  - missing provider key
  - auth failure
  - insufficient quota
  - rate-limit/transport failure
  - AI Gateway credits below `AI_GATEWAY_MIN_CREDITS_USD`
- AI Gateway credits below `AI_GATEWAY_WARN_CREDITS_USD` are a warning, not a
  hard pipeline failure.
- `alleato-source-rag-health` must fail and alert on source lifecycle criticals.
- `alleato-pipeline-alert` must page when a watched source has repeated failed
  runs and no success in the dark window.
- Dashboard warnings are not enough. Critical failures must produce a failed
  scheduled run and a Teams/Slack notification.

## Remediation Sequence

When a gate fails, repair in this order:

1. Provider runway:
   - If below the warning floor, top up/configure AI Gateway autorecharge.
   - If below the hard floor, treat provider health as down.
   - Rerun `npm run rag:verify:render-ai`.
2. Source lifecycle:
   - Run `npm run rag:backfill:source-lifecycle -- --days 2 --source-limit 1500`.
   - Run scoped project assignment backfills only for the degraded source.
   - Refresh stale packets with bounded backend compiler batches.
   - Rerun `npm run rag:verify:source-lifecycle`.
3. Meeting vectorization:
   - Run scoped Fireflies transcript chunk repair for listed failing source ids.
   - Rerun `npm run rag:verify:meetings`.
4. Source-specific retrieval:
   - Fix contract/routing first.
   - Do not change chunking or provider settings until routing is proved correct.

## Closeout Rule

Every RAG task must record:

- gate command
- pass/fail status
- exact failing layer
- cause
- detection gap
- prevention step
- owner file/table/provider
- next action

## Do Not Do

- Do not build a second RAG store.
- Do not treat meeting vectorization as the whole pipeline.
- Do not collapse the AI Gateway warning floor into a hard failure.
- Do not call a one-token provider probe sufficient for provider runway.
- Do not answer user questions as if sources are fresh when any green gate fails.
