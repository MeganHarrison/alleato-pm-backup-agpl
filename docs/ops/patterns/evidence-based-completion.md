# Pattern: Evidence-Based Completion

Last validated: 2026-04-14
Severity: Critical
Category: Workflow reliability

## Problem

Declaring work complete without runtime evidence causes false confidence and repeat failures.

## Required Rule

Do not claim completion until evidence exists for:

1. Quality checks run
2. Tests run (if applicable)
3. Feature behavior validated through concrete outputs/artifacts

## Minimum Evidence Format

- Exact command run
- Pass/fail result summary
- Artifact path or output reference

## Failure Signals

- “Done” claims with no command output or artifact references.
- Regression discovered immediately after a claimed fix.

## Evidence Source

- Legacy references: `docs/patterns/errors/premature-completion.md`, `docs/patterns/INCIDENT-LOG.md`
- Guardrails reference: `AGENTS.md`
