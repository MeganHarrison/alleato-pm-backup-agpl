# ALL-29 Pre-release Verification

Date: 2026-07-26
Workspace: S242 isolated ALL-29 workspace

## Passed

- `PYTHONPATH=backend python3 -m pytest backend/tests/test_training_rag_index.py -q` — 10 passed.
- Focused page, grounding, and assistant-surface Jest suites — 14 passed.
- Focused `/api/training/library/chat` Jest suite — 3 passed.
- Focused ESLint — passed with no warning.
- `npm run training:rag:corpus:check` — current.
- `npm run check:routes` — no conflicts.
- `npm run rag:verify:chat-architecture` — passed.
- `npm run rag:verify:source-specific` — passed.
- `npm run rag:verify:graph-embedding` — passed.
- `npm run map:project -- --check-only` — current.
- `npm run map:system -- --check-only` — current.
- Python compile and `git diff --check` — passed.
- Independent re-review — passed with no remaining P0-P2.

## Known unrelated failures

- Scoped TypeScript reports `frontend/src/components/ai-assistant/chat-area.tsx:739` TS2322 (`Uint8Array` is not assignable to `BlobPart`). The reviewer confirmed the same diagnostic on `origin/main`; no task-owned new file produced a diagnostic.
- `pnpm --dir frontend run build` exited 134 when Next.js exhausted `NODE_OPTIONS=--max-old-space-size=7168`. No ALL-29-specific diagnostic appeared before the out-of-memory termination.
- Repository-wide metadata and backend-client boundary checks still report pre-existing violations in `backend/src/services/supabase_helpers.py:756`, `frontend/src/lib/ai/tools/read/meeting-collection.ts:558`, `frontend/src/lib/ai/tools/read/meeting-tools.ts:281`, and `backend/src/services/agents/outlook_attribution.py:85`.

## Production proof pending

- Deploy backend and frontend.
- Verify `/health/training-library` returns `status=healthy`, zero missing, zero stale, and zero unsearchable.
- Verify signed-in desktop and mobile `/training/ask`, one grounded answer, a clickable source, no overflow, and no product errors.
