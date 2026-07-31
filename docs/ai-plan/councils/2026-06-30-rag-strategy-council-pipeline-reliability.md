# RAG Strategy Council: Pipeline Reliability

Date: 2026-06-30
Status: Implementing first slice
Council question: What is the lowest-risk way to keep Alleato RAG consistently green after repeated source, embedding, packet, and provider regressions?

## Executive Decision

Do not rebuild retrieval. Make `rag:verify:source-lifecycle` plus provider runway
the canonical green gate. The current data path is green; the failing live layer
is AI Gateway credit runway. First implementation slice: make backend provider
health page on low credits, then require operator top-up/autorecharge before the
RAG system is called green.

## Evidence Packet

| Evidence | Source | What it proves | Gap |
|---|---|---|---|
| Source lifecycle verifier | `npm run rag:verify:source-lifecycle` | Recent Fireflies/Teams/Outlook/SharePoint lifecycle, embeddings, packets, and evidence are passing now. | Output is large; must be summarized into the operating plan. |
| Meeting vectorization verifier | `npm run rag:verify:meetings` | 69/69 recent meetings have embedded chunks and retrieval probe works. | Meeting-only; not sufficient alone. |
| Source-specific verifier | `npm run rag:verify:source-specific` | Exact source lookup contract passes. | Contract-level, not full live chat proof. |
| Provider runway verifier | `npm run rag:verify:render-ai` | Backend is configured. AI Gateway balance is `$4.8289`, below the `$5.00` warning floor and above the `$1.00` hard floor. | Direct OpenAI is also configured. |
| Backend cron | `backend/src/services/health/ai_provider_health.py` | Cron catches total provider outages but not low-credit runway. | Needs credit-floor check. |
| Render cron config | `render.yaml` | Multiple RAG health jobs exist, but they are fragmented. | Need one green operating plan. |

## Role Positions

### Repo Architect

Position: Preserve the current packet-first/source-lifecycle architecture and
make the existing strict verifier the control point.

Evidence: `render.yaml` already has RAG health, source RAG health, pipeline
alert, and AI provider health crons; `scripts/verify/verify_source_lifecycle_health.mjs`
is the broadest end-to-end gate.

Risk in the other strategies: Rebuilding retrieval adds another path and hides
the actual provider runway problem.

Minimum viable next step: Add low-credit detection to the backend AI provider
cron.

Guardrail required: The provider cron must fail non-zero and alert before the
gateway reaches zero.

Confidence: High.

### RAG Architect

Position: Retrieval is not the first failing layer in the current snapshot.
Keep chunking and source-specific lookup untouched until a verifier fails.

Evidence: Meeting vectorization and source-specific contract both pass.

Risk in the other strategies: Tweaking chunking/ranking while provider runway is
low creates noise and could destabilize a currently passing path.

Minimum viable next step: Treat source lifecycle as canonical, not meeting-only
coverage.

Guardrail required: Every RAG closeout must include source lifecycle, meetings,
source-specific, and provider runway gates.

Confidence: High.

### AI SDK And Provider Specialist

Position: The live failure is provider runway. A successful one-token probe is
not enough when the account is below the operational credit floor.

Evidence: `rag:verify:render-ai` fails only on AI Gateway credits while backend
health payload reports provider config healthy.

Risk in the other strategies: Falling back to direct OpenAI by default would
hide billing/runway failures and split spend visibility.

Minimum viable next step: Add AI Gateway `/v1/credits` check to backend cron.

Guardrail required: Separate `ok`, `low_credits`, `missing_key`, and provider
transport failures in the health result.

Confidence: High.

### Failure-Mode Reviewer

Position: The repeated failure is not one bug; it is lack of one enforced
definition of green. Multiple partial checks can pass while a critical layer is
already near failure.

Evidence: Existing crons are fragmented; the verifier caught a failure the
backend cron did not.

Risk in the other strategies: A dashboard-only plan still depends on someone
looking. The cron has to fail and page.

Minimum viable next step: Make provider low-credit a non-zero scheduled failure.

Guardrail required: Operating plan with gates, alert channel, owner, and
remediation sequence.

Confidence: High.

### Product Advisor

Position: Users do not care which subsystem is green; they need trusted answers
or an explicit outage. The system should never answer as if current if source
freshness/provider runway is broken.

Evidence: Current source gates pass, so user-facing RAG can be trusted only if
provider runway is fixed.

Risk in the other strategies: Quiet fallback answers erode trust more than a
loud degraded state.

Minimum viable next step: Page and block "healthy" claims until provider runway
is above the floor.

Guardrail required: Final operator status must say exactly which layer is
degraded and what action restores green.

Confidence: High.

## Disagreements And Resolution

| Disagreement | Positions | Resolution method | Decision |
|---|---|---|---|
| Should we patch retrieval first? | RAG Architect says no; Product wants trust. | Current source-specific and meeting verifiers. | Do not patch retrieval until a retrieval gate fails. |
| Is a one-token provider probe enough? | Provider specialist says no; existing cron implied yes. | Compare `ai_provider_health.py` to `verify_render_ai_gateway_health.mjs`. | Add credit-floor probe to cron. |
| Is the pipeline green now? | Source gates are green; provider gate is not. | `rag:verify:render-ai` result. | Overall RAG status is Blocked/Deferred until credits are above floor. |

## Consensus Implementation Sequence

1. Add AI Gateway credit-floor check to backend AI provider cron.
2. Publish a checked-in RAG green operating plan with exact gates and escalation.
3. Top up/configure AI Gateway autorecharge outside code.
4. Rerun provider gate, then rerun source lifecycle as the final green proof.
5. Add a follow-up if source lifecycle ever fails again: remediation should run
   source-lifecycle backfill, project assignment backfill, packet refresh, and
   read-back in that order.

## Verification Gates

| Gate | Command or evidence | Required result | Owner layer |
|---|---|---|---|
| Source lifecycle | `npm run rag:verify:source-lifecycle` | `status: pass`, empty failures | ingestion/assignment/embedding/packet |
| Meetings | `npm run rag:verify:meetings` | no failures | Fireflies/vectorization |
| Source lookup | `npm run rag:verify:source-specific` | pass | retrieval contract |
| Provider runway | `npm run rag:verify:render-ai` | pass and credits above floor | provider/billing |
| Backend cron | `python3 -m src.services.health.ai_provider_health` | fails on low credits, alerts | provider operations |

## Fail-Loud And Recurrence Guardrails

- Cause: Provider runway can fall below a warning floor while one-token probes still succeed.
- Detection gap: Backend provider cron did not check AI Gateway credit balance.
- Prevention step: Add AI Gateway credit-floor check to backend cron and keep `rag:verify:render-ai` in closeout.
- Fail-loud behavior: Credits below the hard floor return `status=down`, `reason=low_credits`, exit non-zero, and alert configured channels. Credits below the warning floor remain green with an explicit warning.

## Open Questions

- Who owns AI Gateway autorecharge/top-up in the provider billing UI?
- Should the warning floor be raised from `$5` after observing daily burn?
- Should low-credit alerts create a Linear issue automatically after Eve runtime delivery is configured?

## Recommended Next Step

Top up or configure autorecharge for AI Gateway, then rerun
`npm run rag:verify:render-ai`.
