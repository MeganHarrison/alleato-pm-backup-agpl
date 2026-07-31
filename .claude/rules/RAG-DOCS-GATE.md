# RAG Architecture Docs Gate

**Trigger:** Any change to RAG, embeddings, document pipeline, vector tables, or RPCs that read/write them.

## Three artifacts that MUST stay current

Stale = the next agent gets the wrong answer.

| Artifact | What it owns | How you update |
|---|---|---|
| [docs/architecture/AI-RAG-ARCHITECTURE.md](../../docs/architecture/AI-RAG-ARCHITECTURE.md) | End-to-end AI/RAG architecture: orchestrator, agents, tool layer, retrieval flow, models, providers, embedding pipeline, search RPCs | Hand-edited markdown. Bump `Last verified: YYYY-MM-DD`. |
| [docs/architecture/tables.yaml](../../docs/architecture/tables.yaml) | Human-authored metadata for every table: purpose, status, gotchas, owner, related tables | **Source of truth.** Hand-edited YAML. New tables fail the drift check until added. |
| [docs/architecture/TABLE-LIST.md](../../docs/architecture/TABLE-LIST.md) | Agent-facing live list of every table with status + row count + one-line purpose | **AUTO-GENERATED.** Run `npm run db:inventory`. Never edit by hand. |
| [docs/architecture/TABLE-INVENTORY.md](../../docs/architecture/TABLE-INVENTORY.md) | Narrative + dated corrections log for the table architecture | Hand-edited markdown. Add a row to the corrections table at the top when something changes. |

**The split, made explicit:**
- "Does table X exist? what's it for? is it live?" → `TABLE-LIST.md` (generated)
- "What does this table's metadata claim?" → `tables.yaml` (source of truth)
- "What changed historically and why?" → `TABLE-INVENTORY.md` (narrative + corrections log)
- "How does the whole AI/RAG system fit together?" → `AI-RAG-ARCHITECTURE.md` (architecture)

## What counts as a "RAG-touching" change

If your change touches any of these paths, you must update **both** docs:

- `frontend/src/lib/ai/**` — orchestrator, agents, tools, providers
- `backend/src/services/pipeline/**` — embedding pipeline
- `backend/src/services/integrations/microsoft_graph/**` — sync that feeds RAG
- `backend/src/services/intelligence/**` — Teams compiler, insight extractors
- `supabase/migrations/**` that touch any of: `document_chunks`, `document_metadata`, `rag_document_metadata`, `rag_pipeline_state`, `outlook_email_intake*`, `document_user_access`, `document_group_access`, any `search_*` RPC, any `acumatica_*` table writer/reader
- `alleato-ai/alleato_ai/tools/rag.py`, `db.py`, `acumatica.py`, `recent.py`, `rerank.py`
- `alleato-ai/alleato_ai/prompts/**` if the prompt changes which tool or source the agent uses

## What to update

### `AI-RAG-ARCHITECTURE.md`
- Tool count if you added/removed/renamed a tool
- Architecture diagram if a layer or data path moved
- Model IDs if a provider/model changed
- Embedding model + dims if the vector format changed
- Retrieval flow if the search RPC, reranker, or hybrid layer changed
- `Last verified: YYYY-MM-DD` line at the top

### `tables.yaml` (and then run `npm run db:inventory`)
- New table: add an entry with `name`, `db` (MAIN | RAG), `domain`, `owner`, `status`, `purpose`. The drift check fails until you do.
- Dropped table: remove its entry. The drift check fails until you do.
- New writer/reader, behavior change, or gotcha discovered: update `purpose` / `gotchas` / `notes_for_ai` on the entry.
- After ANY YAML edit: run `npm run db:inventory`. This regenerates both `TABLE-LIST.md` and the admin-UI inventory. Both should be staged in the same commit.

### `TABLE-INVENTORY.md`
- Add a row to the **post-Wave-N Corrections** section at the top describing the diff (don't rewrite the body).
- Use this for architectural narrative, dated decisions, and "this was wrong, here's reality" entries. NOT for table existence/purpose facts — those go in `tables.yaml`.

## When the change is genuinely unrelated to RAG

The pre-commit hook fires on path globs. If your change is in a RAG-touching path but does not affect architecture or table state (renaming a local var, fixing a typo, updating a comment), explain it in the commit body and the hook will accept it via `--no-verify` IS NOT ALLOWED — instead add a `[skip-rag-docs]` token to the commit subject. The hook honors that opt-out and logs it.

## Why this gate exists

The previous AI implementation had a working data layer underneath a broken agent layer because nobody updated the architecture docs as the system evolved. Every new agent session re-derived the architecture from grep, got pieces wrong, and shipped tools that queried the wrong tables. The pre-commit hook + this gate exist so the next agent reads the doc and trusts it.
