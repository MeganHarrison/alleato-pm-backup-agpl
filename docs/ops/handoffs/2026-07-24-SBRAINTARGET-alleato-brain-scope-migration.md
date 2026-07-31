# Handoff — Alleato Brain Existing-Scope Migration Primitive

Status: Ready to Publish
Session: SBRAINTARGET
Task: ALL-11-SCOPE-MIGRATION

## Summary

Added an explicit, database-backed opt-in for callers that must convert an
existing legacy-container project into its canonical Business Area. Default
behavior and real-project behavior remain unchanged.

## Verification

- `pytest -q backend/tests/test_project_assignment.py` — 24 passed.
- Independent Codex review — APPROVED with no blocking findings.

## Migration ledger evidence

- N/A; this slice changes application logic only.

## Remaining work

- Publish exact owned paths.
