# Handoff: Retired RAG source health ownership

Date: 2026-07-30
Session: S20260730-RAGHEALTH-PROD
Task: AAI-1280-RAG-HEALTH-REPAIR
Status: In progress

## Root Cause

The health aggregator counted historical `teams_chat` Graph rows as current owners. The executable Teams DM owner is `teams_chat_export`.

## Change

The shared inactive Graph-resource predicate now retires `teams_chat` for live state and snapshot fallback. Historical rows remain available for incident analysis.

The Graph parent freshness key now matches the source ledger's canonical
`microsoft_graph_source_sync` identity, and the aggregate `microsoft_graph`
document source inherits that receipt along with Outlook, SharePoint, and Teams
channel sources.

## Verification

`python -m pytest -q backend/tests/test_source_sync_health.py` passed all 28 tests.

After the first production deployment, authenticated recompute reduced active
sources from 344 to 61, alerts from 289 to 6, and returned retired `teams_chat`
rows from 77 to 0. The six exposed active alerts localized the parent freshness
identity mismatch repaired in the second slice.

## Remaining Active Issues

- SharePoint initial inventory backlog
- Eligible document vectorization backlog
- One unconfigured Graph subscription
- Missing SharePoint promotion rows
- Acumatica historical AR applications blocked on a provider GI
