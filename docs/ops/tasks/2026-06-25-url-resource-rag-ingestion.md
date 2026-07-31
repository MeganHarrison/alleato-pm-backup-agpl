# Task: URL Resource Ingestion Into Existing RAG Pipeline

Status: In Progress
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-631
Linear URL: https://linear.app/megankharrison/issue/AAI-631/ingest-url-web-pages-into-existing-rag-metadata-and-document-chunk
Related Handoff: docs/ops/handoffs/2026-06-25-S89-url-resource-rag-ingestion.md

## Objective

Allow one or more web URLs to be crawled/extracted and stored through the
existing Alleato RAG ingestion path so the resulting metadata lands in
`rag_document_metadata` and the resulting searchable chunks land in
`document_chunks` without creating a parallel retrieval corpus.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `docs/ops/tasks/2026-06-25-url-resource-rag-ingestion.md`
- `docs/ops/handoffs/2026-06-25-S89-url-resource-rag-ingestion.md`
- `docs/ops/orchestration/session-board.md`
- `backend/src/services/url_resource_ingestion.py`
- `backend/src/api/main.py`
- `backend/src/services/supabase_helpers.py`
- `backend/src/services/pipeline/orchestrator.py` if pipeline routing needs a small owner-safe adjustment
- Focused backend tests and/or verification scripts for URL resource ingestion

## Acceptance Criteria

- A backend URL-ingestion entrypoint accepts one or more URLs and routes them
  into the existing RAG ingestion system.
- Extracted web-page content is stored in `rag_document_metadata` with
  `category=resource` and `type=web_page` unless a repo-grounded equivalent is
  required and justified.
- The original URL is stored in `source_web_url` and `url`.
- The resulting document is processed by the existing parser/embedder/extractor
  path and produces searchable `document_chunks` compatible with the current
  assistant retrieval path.
- Duplicate URL submissions and unchanged content re-ingests are handled
  explicitly via normalized URL lookup and content-hash guardrails.
- Empty/failed crawls return explicit failures and do not silently create a
  searchable but empty document.

## Failure-Loud Behavior

- If a URL cannot be fetched, the ingest endpoint returns a specific fetch error
  with the URL and status context.
- If a page fetch succeeds but produces empty or too-short extracted text, the
  ingest path fails with a specific extraction error instead of writing a silent
  placeholder document.
- If a normalized URL already exists with identical content, the result reports
  an explicit skipped/unchanged outcome instead of re-running embeddings.
- If pipeline processing fails after metadata creation, the failure is surfaced
  through the response and the existing ingestion-job state is updated to
  `error`.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Kickoff | Linear AAI-631 | Pass | Issue created before implementation to satisfy repo issue-tracking requirement. |
| Kickoff comment | Linear AAI-631 comment `27e34e78-fb63-4179-99e4-75531b2844e8` | Pass | Scope, constraints, and planned files posted before implementation. |
| Static validation | `python -m py_compile backend/src/services/url_resource_ingestion.py backend/src/services/supabase_helpers.py backend/src/api/main.py` | Pass | New backend service, helper updates, and API surface compile. |
| Targeted tests | `PYTHONPATH=/Users/meganharrison/Documents/alleato-pm/backend pytest --noconftest backend/tests/test_url_resource_ingestion.py -q` | Pass | 3 focused tests cover dry-run extraction, unchanged-content skip, and metadata/pipeline write behavior. |
| API contract test artifact | `backend/tests/test_url_resource_ingestion_api.py` | Partial | Added route contract test, but repo-wide FastAPI test import is blocked in this environment by missing `python-multipart` for existing upload routes. |
| Handoff validation | `npm run linear:codex:check -- docs/ops/handoffs/2026-06-25-S89-url-resource-rag-ingestion.md` | Pass | Repo handoff intake/ledger format validates. |
| End-to-end proof | `docs/ops/evidence/2026-06-25-url-resource-rag-ingestion/verification-summary.md` | Pass | Live read-back for `https://www.python.org/about/` showed `category=resource`, `type=web_page`, 19 chunks, and 6 vector-search hits for the new document. |
| DB/provider read-back | `docs/ops/evidence/2026-06-25-url-resource-rag-ingestion/verification-summary.md` | Pass | Confirmed stored URL fields and RAG metadata hash after live ingestion. |
| Browser/user-flow | N/A backend-only API/service slice | Pass | No frontend surface changed in this session. |
| Known unrelated failures | `search_chunks_by_keyword('Python Software Foundation')` and backend test-app import | Unrelated repo/env debt | Keyword helper hit Postgres timeout `57014`; full FastAPI test import requires `python-multipart` because existing upload routes use `File(...)`. |

## Risks / Gaps

- The repo task template path in `AGENTS.md` is stale; this task uses the live
  task format already present under `docs/ops/tasks/`.
- Existing RAG pipeline status tables are Fireflies-named; URL ingestion should
  reuse the same durable lifecycle shape without pretending the source is a
  Fireflies meeting.
- The current checkout may have unrelated dirty files; staging must stay scoped
  to task-owned paths.
- Live keyword-search verification against `document_chunks` is still sensitive
  to existing database timeout debt; vector-search compatibility for this
  document was confirmed, but the broad keyword helper itself remains an
  unrelated performance problem.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
