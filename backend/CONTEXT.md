# Backend Context

## Owns

- FastAPI APIs and services under `backend/src/`.
- Ingestion, OCR, RAG, project intelligence, and background-processing behavior.
- Render-hosted backend runtime configuration described by `render.yaml`.

## Start here

- `docs/architecture/AI-RAG-ARCHITECTURE.md` for AI and retrieval flows.
- `docs/architecture/OCR-PIPELINE.md` before drawing OCR changes.
- `docs/architecture/tables.yaml` for database ownership and fields.
- Root `CONTEXT.md` and relevant `docs/ops/adr/` decisions.

## Guardrails

- Preserve loud failures at external-service and data-boundary seams.
- Follow the Supabase types and migration-application gates for database work.
- Verify backend changes through the actual frontend or integration flow when
  users depend on that behavior.
