# Context Map

Use this map to select the smallest relevant repository context before
exploration. The root `CONTEXT.md` remains the shared glossary for concepts that
cross these surfaces.

| Work concerns | Read first | Then consult |
| --- | --- | --- |
| Next.js routes, React UI, Supabase browser/server adapters, user-facing workflows | `frontend/CONTEXT.md` | `docs/architecture/PROJECT-MAP.md`, `docs/architecture/tables.yaml`, relevant `docs/ops/adr/` decisions |
| FastAPI APIs, ingestion, OCR, RAG, background processing, Render runtime | `backend/CONTEXT.md` | `docs/architecture/AI-RAG-ARCHITECTURE.md`, `docs/architecture/OCR-PIPELINE.md`, relevant `docs/ops/adr/` decisions |
| Agent packages, prompts, evals, schedules, issue intake, autonomous workflows | `agents/CONTEXT.md` | `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, package-local `README.md` files |
| Cross-surface domain language or a design decision | `CONTEXT.md` | every affected context plus `docs/ops/adr/` |

Do not load every context by default. Start with the row that owns the user
outcome and add another only when the workflow crosses that boundary.
