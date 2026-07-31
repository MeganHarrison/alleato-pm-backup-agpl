# ADR-0003: One Chat-turn research contract owns source evidence

Date: 2026-07-22
Status: Accepted
Owner: Engineering

## Context

AI chat source selection is currently reconstructed in the retrieval planner, prefetch dependencies, strategist tool composition, FMDS visibility filter, prompt instructions, trace formatting, and citation persistence. AAI-1244 repaired one FMDS-plus-communications request by adding a narrow exception in several of those places. That restored the immediate user flow but left the recurring failure class intact: a source requested upstream can disappear or be misreported downstream.

The ASRS FMDS cutover council correctly requires one revision-scoped engineering corpus and forbids generic RAG or communication evidence from establishing an FMDS conclusion. It also states that an FMDS plan exposes only the ASRS tools. Mixed requests reveal a second legitimate operation, however: users may ask for separate operating/process research across company communications in the same Chat turn.

## Decision

One Chat-turn research contract owns requested source families, evidence authority, authorized read adapters, required outcomes, and the projections used by prefetch, live tool visibility, prompt obligations, trace, citations, and quality verification.

- FMDS remains the only authoritative source family for an FMDS engineering conclusion.
- Explicit mixed operating/process research may add only the requested read adapters for meetings, email, Teams, or OneDrive. Those findings are non-authoritative for the FMDS conclusion.
- Direct source reads are evidence adapters. The Microsoft specialist is a separate optional analysis/operator adapter; its availability, provider, or credit state must not determine whether requested evidence can be read.
- Every requested source produces a Research receipt that distinguishes complete, empty, denied, unavailable, timed out, and failed outcomes.
- A Chat turn cannot claim complete source coverage unless every required receipt is complete or empty after a successful read.

This amends the council's “ASRS tools only” rule for explicit mixed operating research while preserving the underlying no-generic-RAG and revision-isolation decisions.

## Alternatives Considered

- Keep the AAI-1244 exception in the FMDS filter and prompt. Rejected because each new source or route must be added in several modules and can drift again.
- Route all Microsoft evidence through the specialist. Rejected because source evidence then depends on a separate provider/credit path and conflates retrieval with analysis/operator work.
- Leave tool choice entirely to the model. Rejected because authorization, source isolation, completeness, and engineering evidence authority are deterministic product contracts.

## Consequences

- Positive: source-policy changes gain locality; every Chat-turn path consumes one interface and one receipt model.
- Positive: tests exercise the same interface as production callers and can prove missing-source failures without model prose.
- Negative: existing planner, prefetch, tool, prompt, trace, and citation code must migrate together; partial adoption is invalid.
- Operational impact: direct source-read permissions remain unchanged, and FMDS revision isolation remains fail-closed.

## Rollback Plan

Revert the contract adoption as one commit, restoring the prior planner, FMDS filter, tool composition, prompt, trace, and citation projections together. Do not roll back only one projection because that recreates the drift this decision prevents.
