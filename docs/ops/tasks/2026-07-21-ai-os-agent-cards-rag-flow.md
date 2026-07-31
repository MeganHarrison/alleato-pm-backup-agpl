# Task: Add AI OS agent cards and RAG flow

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: local-ai-os-agent-cards-rag-flow
Linear Issue: Not required, direct dashboard refinement
Related Handoff: N/A, direct task

## Objective

Replace the dense AI agent list with minimal expandable cards and add a clear RAG retrieval-flow section to the canonical AI Operating System dashboard.

## Scope

- `frontend/src/components/ui-library/expandable-card-demo-standard.tsx`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-data.ts`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os.module.css`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-charts.tsx`
- `.agents/skills/impeccable/SKILL.md`
- `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-roadmap-kanban.tsx` (remove ungrounded roadmap)
- `frontend/src/app/(main)/ai-dashboard/ai-os/company-brain.tsx` (remove fabricated knowledge graph)
- `frontend/src/app/(main)/ai-dashboard/workspace-shell.tsx`
- `frontend/src/app/(main)/ai-dashboard-theme.module.css`
- Excludes pipeline services, retrieval behavior, and dashboard data-source changes.

## Source of Truth

- Canonical route: `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-preview.tsx`
- Existing interaction owner: `frontend/src/components/ui-library/expandable-card-demo-standard.tsx`
- Canonical RAG product route: `/ai-dashboard/rag-pipeline`

Verification contract: Required

## Acceptance Criteria

- [ ] Agent records render as clean, expandable cards using the shared interaction owner.
- [ ] A RAG retrieval section explains collection, grounding, indexing, and retrieval-to-answer flow.
- [ ] Desktop and mobile behavior are browser-inspected.
- [ ] Ungrounded roadmap records, fabricated ownership, and fabricated knowledge-graph entities are removed from the executive surface.
- [ ] The cumulative knowledge-growth graph is removed; the ingestion legend is beside the full-width chart; pipeline telemetry is deferred to the page bottom.
- [ ] AI tool-library cards use a three-column desktop grid for readable summaries.
- [ ] Section headings and the page end have intentional breathing room.
- [ ] Intelligence summaries open their underlying canonical content; the design skill rejects detached output counts.
- [ ] Wide-dashboard shell gutters use 20px, and active navigation uses a dark surface rather than the orange accent.
- [ ] The dark dashboard uses a shared cool-blue accent, with no orange AI OS chart-series role.

## Failure-Loudly Contract

- Cause surfaced as: N/A. This is a static dashboard presentation refinement with no new source call.
- Detection path: focused lint, interaction test, and authenticated browser review.
- Recovery path: agent details remain available in the expanded card, while the canonical RAG route remains linked for operational detail.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and shared component owner recorded before implementation. |

## Remaining Risk

- Data remains illustrative until live agent and retrieval telemetry is connected.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
