# Handoff: Graph embedding backlog drain

Date: 2026-07-30
Session: S20260730-RAGBACKLOG
Task: AAI-1280-RAG-BACKLOG-DRAIN
Status: Accepted

## Root Cause

`render.yaml` configured `GRAPH_EMBEDDING_LIMIT=100`, but the split-phase Graph runner clamped the value to 25. The production owner therefore processed at most one quarter of its declared batch.

## Change

The runner accepts 100 candidates per embedding phase. The required $10 daily model budget remains the hard cost boundary.

The same focused blueprint suite exposed four scheduled services that call the
PM Supabase client without declaring `SUPABASE_SERVICE_ROLE_KEY` in the
canonical blueprint. The source contract is restored for source-sync health,
RFI email ingestion, project-intelligence staleness checks, and email digest.

## Verification

`python -m pytest -q backend/tests/test_render_sync_blueprints.py`: 12 passed.

Independent review approved with no findings. Artifact:
`C:\Users\KimiClaw\AppData\Local\Temp\AAI-1280-backlog-independent-review.md`.

## Release

Published to canonical `origin/main` through the required `codex:finish` flow.
The Render cron control plane and an immediate cron execution cannot be read
back from this session because no Render API credential is available.
