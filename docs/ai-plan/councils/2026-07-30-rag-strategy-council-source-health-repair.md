# RAG Strategy Council: Source health repair

Date: 2026-07-30
Status: Accepted
Council question: Which remaining production RAG failures are real ingestion defects, which are health-reporting defects, and what should be repaired first?

## Executive Decision

Repair the health aggregation boundary first. Production currently reports 77 retired teams_chat resources from April and May as active critical owners even though the live Teams direct-message owner is teams_chat_export. Those rows consume the entire returned alert window and conceal current SharePoint, vectorization, subscription, and Acumatica signals.

After that repair is deployed, recompute live health and work the now-visible active backlog in bounded source-owner batches. Do not describe Acumatica historical payment applications as fixed until the provider exposes the required Generic Inquiry or endpoint.

## Evidence Packet

| Evidence | Source | What it proves | Gap |
|---|---|---|---|
| Authenticated production health response | `GET https://alleato-backend-rbnj.onrender.com/api/health/source-sync` | 344 sources and 289 alerts are counted; the returned 80-source window contains 77 retired teams_chat rows | The fixed aggregator is not deployed yet |
| Current Teams implementation | `backend/src/services/integrations/microsoft_graph/sync.py` | Current Teams DM state and run ledgers use `teams_chat_export` | Current Teams DM cron still needs post-deploy live readback |
| Existing verifier contract | `scripts/verify/verify_integration_health.py` | teams_chat is already explicitly classified as a legacy Graph state source | The API aggregator did not reuse the same retirement rule |
| Production pipeline metrics | Authenticated source health response | 2,036 sampled documents lack chunks, 57 SharePoint project folders await initial inventory, one Graph subscription is unconfigured, and 282 sampled SharePoint documents lack promotion rows | Counts are sample-bounded and must be recomputed after retired alerts are removed |
| Acumatica error contract | Production source row plus `backend/src/services/acumatica_sync.py` | Current Acumatica endpoint does not expose historical AR payment application lines; fallback is explicitly labeled | Requires an Acumatica GI/provider change |

## Role Positions

### Repo Architect

Position: One canonical retired-source predicate must govern live rows and stored snapshots.

Evidence: The verifier already knows teams_chat is retired, but `source_sync_health.py` only retires OneDrive and inactive SharePoint resources.

Risk in the other strategies: Running more ingestion before repairing observability leaves active failures hidden behind obsolete alerts.

Minimum viable next step: Add teams_chat to the canonical inactive Graph-resource predicate and cover both live state and snapshot fallback.

Guardrail required: A regression test must prove retired rows never affect source counts, health status, or alerts.

Confidence: High.

### RAG Architect

Position: Separate acquisition, content extraction, vectorization, promotion, and retrieval health; do not treat a single activity signal as pipeline health.

Evidence: The current payload simultaneously shows fresh SharePoint discovery, incomplete initial inventories, no chunks for 2,036 sampled documents, and 282 missing project-document promotions.

Risk in the other strategies: Relabeling all missing chunks as harmless would hide genuine raw-ingested content that is not retrievable.

Minimum viable next step: Clear the false owner rows, then drain only eligible content-bearing vectorization candidates and remeasure coverage.

Guardrail required: Health must retain separate counts and actionable alerts for source inventory, vectorization, promotion, and retrieval.

Confidence: High.

### AI SDK And Provider Specialist

Position: The AI Gateway/OpenAI transport is not the first failed boundary in this incident.

Evidence: A prior production workflow completed load, parse, vision, embed, extract and returned a scoped vector match; the current failures begin in source acquisition and health classification.

Risk in the other strategies: Rotating provider credentials or changing models would add noise and cannot repair retired Graph rows or missing SharePoint inventory.

Minimum viable next step: Leave BYOK/Gateway routing unchanged while source-owner health is repaired.

Guardrail required: Provider failures must remain separately identifiable as authentication, credit, quota, or document-specific errors.

Confidence: High.

### Failure-Mode Reviewer

Position: Do not delete evidence blindly; retire it from active health while preserving historical diagnosis.

Evidence: Old teams_chat rows contain useful 403 history, but they no longer represent an executable owner.

Risk in the other strategies: Database deletion would lose incident history, while continuing to count the rows produces permanent false critical health.

Minimum viable next step: Filter retired owner identities at the aggregation boundary and resolve their persisted active alerts during recompute.

Guardrail required: The recompute path must fail loudly if current active sources remain critical after retired rows are excluded.

Confidence: High.

### Product Advisor

Position: The operator view must show the few current blockers, not hundreds of obsolete alerts.

Evidence: The 80-row API cap currently prevents the user from seeing the vectorization and promotion alerts that matter.

Risk in the other strategies: A superficially green rollup would be as misleading as the current permanently red one.

Minimum viable next step: Produce an ownership and functionality document that labels each feature as live, degraded, externally blocked, or retired.

Guardrail required: Every completion claim includes live freshness, coverage, backlog, and retrieval evidence.

Confidence: High.

## Disagreements And Resolution

| Disagreement | Positions | Resolution method | Decision |
|---|---|---|---|
| Delete old Teams rows or preserve them | Failure reviewer favors preservation; cleanup preference favors deletion | Compare operational value with active-health semantics | Preserve historical rows, exclude them from active ownership, and resolve active alerts |
| Mark no_text rows as vector backlog | RAG architect says only content-bearing candidates can be embedded; product needs missing-text visibility | Compare embed candidate statuses with OCR/source extraction owners | Exclude nothing merely to improve the number; report missing text and missing chunks as distinct stages |
| Treat Acumatica fallback as success | Product wants working financial answers; provider evidence shows historical applications unavailable | Live entity metadata and endpoint error | Keep it externally blocked and actionable; never claim full historical payment allocation |

## Consensus Implementation Sequence

1. Retire legacy teams_chat state and snapshot rows from active source health, with regression coverage.
2. Deploy, recompute health, and confirm the alert window exposes current owners.
3. Drain bounded eligible vectorization and SharePoint bootstrap work, measuring coverage after each batch.
4. Publish the complete Eve functionality and RAG ownership/status catalog.
5. Leave Acumatica historical payment applications explicitly blocked until its GI exists.

## Verification Gates

| Gate | Command or evidence | Required result | Owner layer |
|---|---|---|---|
| Retired owner contract | `pytest -q backend/tests/test_source_sync_health.py` | Retired teams_chat rows and snapshots produce no source or alert | ingestion health |
| Live health readback | Authenticated `POST /api/health/source-sync/recompute` then `GET /api/health/source-sync` | No active teams_chat sources or alerts | operations |
| Vector coverage | Live health counts plus scoped retrieval probe | Backlog declines and a current document returns a relevant vector match | vectorization/retrieval |
| Eve-only runtime | `npm run verify:eve-only-runtime` | Only `agents/alleato-assistant` owns generation | assistant runtime |
| Documentation contract | Exact-path/source audit | Every assistant capability names owner, route, data source, status, and failure mode | product |

## Fail-Loud And Recurrence Guardrails

- Cause: The production health aggregator accepted every historical `graph_sync_state.source` as a current executable owner.
- Detection gap: The standalone verifier filtered teams_chat, but the API and snapshot fallback did not share that invariant.
- Prevention step: Define retired Graph owner identities in the health owner and apply the predicate to live state and persisted snapshots.
- Fail-loud behavior: Current source failures remain critical and actionable; only identities with no executable owner are excluded.

## Open Questions

- Which one of the 11 active Graph subscriptions is no longer configured, and should it be removed or restored?
- How many of the 2,036 sampled no-chunk documents are content-bearing embed candidates versus missing-text source records?
- Can the current SharePoint bootstrap rate clear 57 pending folders within its intended service-level objective?

## Recommended Next Step

Implement and deploy the retired-owner guardrail, recompute production health, and use the newly visible active alerts to drive bounded repairs.
