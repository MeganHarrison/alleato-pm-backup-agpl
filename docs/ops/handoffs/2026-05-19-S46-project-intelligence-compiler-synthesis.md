# Handoff: 2026-05-19 — Project Intelligence Compiler Synthesis

## Intake Block

1) Session ID: S46
2) Task ID: AAI-386
3) Linear issue: AAI-386
4) Linear URL: https://linear.app/megankharrison/issue/AAI-386/rebuild-project-intelligence-packet-compiler-for-source-backed
5) Current status: Pending Review after rework
6) Files changed (absolute paths): /Users/meganharrison/Documents/alleato-pm/backend/src/services/intelligence/compiler.py; /Users/meganharrison/Documents/alleato-pm/backend/src/services/intelligence/operating_summary.py; /Users/meganharrison/Documents/alleato-pm/backend/tests/test_intelligence_compiler.py; /Users/meganharrison/Documents/alleato-pm/backend/tests/test_project_operating_summary.py; /Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/intelligence/page.tsx; /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/intelligence/advisor-synthesis.ts; /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/__tests__/advisor-synthesis.test.ts; /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/retrieval/system-prompt.ts; /Users/meganharrison/Documents/alleato-pm/frontend/src/lib/ai/retrieval/__tests__/system-prompt.test.ts; /Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_ai_packet_synthesis_quality.mjs; /Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_ai_intelligence_compiler_health.mjs; /Users/meganharrison/Documents/alleato-pm/package.json; /Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-RAG-ARCHITECTURE.md; /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md; /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/review-queue.md; /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-05-19-S46-project-intelligence-compiler-synthesis.md
7) Commands run and outcome (pass/fail counts): `backend/.venv/bin/python -m py_compile backend/src/services/intelligence/compiler.py backend/src/services/intelligence/operating_summary.py` pass; `node --check scripts/verify/verify_ai_packet_synthesis_quality.mjs && node --check scripts/verify/verify_ai_intelligence_compiler_health.mjs` pass; `backend/.venv/bin/python -m pytest backend/tests/test_intelligence_compiler.py backend/tests/test_project_operating_summary.py` pass 16/16; `npm run rag:verify:packet-synthesis-quality -- --project-id 1009` failed before refresh because packet compilerVersion was `ai_intelligence_compiler_v0_1`; direct Union refresh through `refresh_project_operating_packet(..., 1009)` pass; rerun `npm run rag:verify:packet-synthesis-quality -- --project-id 1009` pass; user review failed the page/assistant quality; rework ran `backend/.venv/bin/python -m py_compile backend/src/services/intelligence/operating_summary.py` pass; `node --check scripts/verify/verify_ai_packet_synthesis_quality.mjs` pass; `cd frontend && npx jest src/lib/ai/retrieval/__tests__/system-prompt.test.ts src/lib/ai/__tests__/advisor-synthesis.test.ts --runInBand` pass 14/14; `cd frontend && npx tsc --noEmit --pretty false --skipLibCheck` pass; `backend/.venv/bin/python -m pytest backend/tests/test_project_operating_summary.py -q` pass 5/5; accidental broad `npm test -- --runTestsByPath ...` failed on unrelated existing suites `marketing-service` and `ProjectCreatedModal`; `npm run rag:verify:intelligence-compiler -- --max-queued-minutes 180 --max-running-minutes 180 --recent-failure-hours 72` fail due unrelated/backlog compiler health debt; follow-up production review found the page still used fatal wording for evidence-limit notes, so the intelligence page was patched to separate `Source quality failure` from `Evidence limitations`; follow-up full `cd frontend && npx tsc --noEmit --pretty false --skipLibCheck` failed with Node heap out of memory before type errors; deterministic launch rework added `buildIntelligencePageState` and a fixture test; `cd frontend && npx jest src/lib/ai/__tests__/intelligence-page-state.test.ts src/lib/ai/retrieval/__tests__/system-prompt.test.ts src/lib/ai/__tests__/advisor-synthesis.test.ts --runInBand` pass 17/17; `node -e "JSON.parse(...assistant-eval-suite.json...)"` pass; `cd frontend && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --pretty false --skipLibCheck` pass; first bounded Union assistant eval failed because no local server was listening; after `npm run dev:frontend`, `AI_EVAL_BASE_URL=http://localhost:3001 AI_EVAL_JUDGE_ENABLED=false AI_EVAL_CASE_TIMEOUT_MS=45000 node scripts/verify/verify_ai_assistant_eval_suite.mjs --case project-briefing-union-meeting-coverage` pass 1/1.
8) Evidence artifacts (screenshot/video/report/log paths): Terminal evidence in current Codex run; live packet ID `6e6558f3-b8b9-42fa-931a-c4cfafee4036`; reworked packet generated at `2026-05-19T14:05:18.031Z`; local browser screenshot `tests/agent-browser-runs/2026-05-19-union-intelligence-review/union-intelligence-local.png`.
9) Top 3 findings (frontend-visible issues first): First review was wrong-layer verified; page still treated evidence gaps as resynthesis failure and rendered card summaries/duplicate next actions instead of the structured strategic report; assistant prompt/advisor context did not expose operating packet meeting coverage, enabling answers that claimed no Union meeting transcripts surfaced even though the packet selected 32 meeting sources.
10) Recommended next action (one line): Deploy the deterministic page-state/eval guard, spot-check production after the deployment is ready, then drain stale compiler jobs and refresh remaining high-value project packets through the operating-summary compiler.
11) Handoff file path: docs/ops/handoffs/2026-05-19-S46-project-intelligence-compiler-synthesis.md
12) Migration ledger evidence: N/A, no migration in this slice.

## Linear Updates

- Kickoff comment: Posted 2026-05-19.
- Milestone comments: Posted 2026-05-19.
- Completion/blocker comment: Posted 2026-05-19.

## Current Status

Implemented and locally verified after a failed user review. Client-project packet refreshes now use the operating-summary synthesis compiler by default, source imports enqueue rather than immediately spending a packet LLM call per source, source-quality scoring is stored in the selected source set/coverage, Union Collective was refreshed through the new compiler, the page now renders `packet_json.strategicReport` directly, and the assistant prompt/advisor context now exposes operating packet source coverage including meetings.

## Exact Next Step

Deploy this rework, retest production `/1009/intelligence` plus an AI assistant Union prompt, then run a bounded compiler repair/drain for stale jobs and refresh the next highest-value project packets.

## Known Pitfalls

Existing stale failed compiler jobs remain backlog debt. The broad compiler-health check still fails on stale running/failed queue rows, two stuck high-confidence candidates, and active cards missing from non-refreshed current packets.

The first review failure was a verification-process miss: DB packet checks passed, but the actual page and assistant answer path were not tested before handoff. The added guardrails now check repeated next actions, meeting source coverage, prompt rendering of `strategicReport`, and advisor synthesis use of operating packet source coverage.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
backend/.venv/bin/python -m pytest backend/tests/test_intelligence_compiler.py backend/tests/test_project_operating_summary.py
cd frontend && npx jest src/lib/ai/retrieval/__tests__/system-prompt.test.ts src/lib/ai/__tests__/advisor-synthesis.test.ts --runInBand
cd frontend && npx tsc --noEmit --pretty false --skipLibCheck
npm run rag:verify:packet-synthesis-quality -- --project-id 1009
npm run rag:verify:intelligence-compiler -- --max-queued-minutes 180 --max-running-minutes 180 --recent-failure-hours 72
```

## Evidence

- Before refresh: `npm run rag:verify:packet-synthesis-quality -- --project-id 1009` failed because current packet compilerVersion was `ai_intelligence_compiler_v0_1`.
- Refresh result: Union Collective packet `6e6558f3-b8b9-42fa-931a-c4cfafee4036`; `card_count=10`; `linked_evidence_count=90`; `available_sources=96`; `compiler_version=project-operating-summary-v1`; headline `Union Collective is moving from concept to permit-ready design, but schedule, financing, and scope-control remain the main pressure points.`
- After refresh: packet synthesis verifier passed with `placeholderCount=0`, `placeholderRatio=0`, and source quality counts `clean_source=63`, `metadata_only=33`, `raw_dump=0`, `stale_or_failed=0`.
- After user review failed: browser confirmed production page still led with `Daily intelligence needs resynthesis before agents rely on it` and repeated the same next action under multiple sections.
- Rework refresh result: same Union packet ID `6e6558f3-b8b9-42fa-931a-c4cfafee4036`; generated at `2026-05-19T14:05:18.031Z`; `linked_evidence_count=95`; `card_count=10`; meeting coverage `32 selected / 32 available`; recommended next moves now start with `Freeze permit-critical scope and run a formal change-control process`.
- Rework verifier result: `npm run rag:verify:packet-synthesis-quality -- --project-id 1009` passed with `placeholderRatio=0` and `repeatedNextActionRatio=0.3`.
- Local browser review on `http://localhost:3001/1009/intelligence` showed the page no longer leads with resynthesis failure; it shows `Daily project intelligence, synthesized from the sources that changed the job`, strategic report sections, evidence limitations, and Meeting coverage.
- Follow-up production review on `https://projects.alleatogroup.com/1009/intelligence` showed the deployed page still led with `Daily intelligence needs resynthesis before agents rely on it`; root cause was the UI wording/state path still conflating fatal source-quality failures with normal evidence limitations, so the page now renders those sections separately.
- Deterministic launch guard now asserts a passed strategic report with evidence gaps renders `Daily project intelligence, synthesized from the sources that changed the job`, not fatal resynthesis or failed quality copy.
- Local browser review on `http://localhost:3001/1009/intelligence` after the guard showed the correct headline and separate `Evidence limitations` sections.
- Bounded local assistant eval `project-briefing-union-meeting-coverage` passed; final answer explicitly said meeting transcripts are available in the packet and excluded the prior `no meeting transcripts surfaced` failure phrasing.
- Broad compiler health remains failing: `sourceStaleRunning=2`, `sourceRecentFailed=8`, `packetRecentFailed=4`, `highConfidenceUnpromoted=2`, `activeCardsMissingCurrentPacket=351`.
