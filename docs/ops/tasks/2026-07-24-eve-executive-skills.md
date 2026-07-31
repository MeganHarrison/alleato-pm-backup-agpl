# Task: Convert Executive Specialists to Eve Skills

Status: In Progress
Owner: Codex
Created: 2026-07-24
Task ID: local-eve-executive-skills
Linear Issue: Unavailable; this is a single-session local migration with no Linear request.
Related Handoff: N/A

## Objective

The Alleato Analyst Eve agent discovers and load-routes six executive analysis
procedures as skills instead of requiring separate CFO, COO, CRO, CHRO, VP BD,
and CMO agent identities.

## Scope

- Add six Eve skills under `agents/alleato-analyst/agent/skills/`.
- Add deterministic routing eval coverage for every new skill.
- Update only the analyst's eval fixture behavior needed to exercise skill loading.
- Exclude production AI Assistant routing, production data adapters, tool migration,
  removal of the legacy C-suite orchestrator, and deployment.

## Source of Truth

- Canonical runtime/data owner: `agents/alleato-analyst/`
- Existing shared primitives/services:
  - `agents/alleato-analyst/agent/agent.ts`
  - `agents/alleato-analyst/agent/skills/analysis-rules.md`
  - `frontend/src/lib/ai/agents/{cfo,coo,cro,chro,vpbd,cmo}.ts`
  - `frontend/src/lib/ai/orchestrator.ts`
- Deprecated or parallel paths: the production C-suite specialist path remains
  active and is explicitly deferred until the Eve assistant integration reaches
  parity.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] Eve discovers `financial-analysis`, `operations-review`, `risk-review`,
  `people-capacity`, `business-development`, and `marketing-strategy`.
- [ ] Each skill description is an intent-oriented routing contract.
- [ ] Each skill separates procedure from executable capability and requires
  evidence-backed, failure-loud answers.
- [ ] One focused eval proves each representative prompt loads the expected skill.
- [ ] Existing Alleato Analyst evals continue to pass.
- [ ] Eve info, typecheck, build, and focused evals pass.
- [ ] An independent reviewer finds no blocking issue.
- [ ] Legacy specialist removal is explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [ ] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
  unchanged; skills must not imply access that tools do not provide.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Eve runtime evals prove all six skill-routing outcomes.
- [ ] Evidence artifacts are recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the reply names the missing authenticated adapter or evidence
  source instead of pretending the skill supplied data access.
- Detection path: `eve info`, skill-routing evals, and the Eve eval artifact.
- Recovery path: add or authorize the required typed tool, then extend the relevant
  skill eval to assert the tool call and evidence.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: skill-routing evals prevent silent loss or collision of the
  six migrated procedures.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |

## Remaining Risk

- Production assistant integration and retirement of the legacy C-suite agents are
  deferred. Owner: AI Assistant migration. Next action: expose authenticated
  project tools to the Eve root assistant and run parity evals before deleting the
  legacy route.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
