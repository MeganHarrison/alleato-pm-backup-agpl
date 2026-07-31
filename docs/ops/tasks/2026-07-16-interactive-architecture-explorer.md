# Task: Interactive Architecture Explorer

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1110
Linear Issue: [AAI-1110](https://linear.app/megankharrison/issue/AAI-1110/redesign-architecture-assurance-as-an-interactive-codebase-explorer)
Related Handoff: `docs/ops/handoffs/2026-07-16-S161-interactive-architecture-explorer.md`

## Objective

Replace the text-heavy Architecture Assurance page with a visual, interactive explanation of how the codebase is organized and which systems keep it clean, so Brandon can understand the existing strategy without receiving repository mutation controls.

## Source of Truth

- Operator and repository rules: `AGENTS.md`.
- Domain vocabulary and source ownership: `CONTEXT.md`.
- Generated route and API inventory: `docs/architecture/PROJECT-MAP.md`.
- Generated app-surface manifest: `frontend/src/lib/app-surface/app-surface.generated.json`.
- Generated cross-layer map: `docs/architecture/SYSTEM-MAP.md` and `docs/architecture/generated/system-map.json`.
- Human-authored database ownership metadata: `docs/architecture/tables.yaml`.
- System boundaries: `docs/architecture/ALLEATO-SYSTEM-MAP.md` and `docs/architecture/AI-RAG-ARCHITECTURE.md`.
- Shared UI owners: `AiDashboardWorkspaceShell`, `WorkspacePageIntro`, `WorkspaceSection`, and existing UI primitives.

Verification contract: Required

## Attention Architecture

- Primary user: Brandon, reviewing the platform as an executive rather than a developer.
- Primary job: understand that the codebase has intentional structure and a controlled change process.
- Primary decision: trust the existing architecture workflow and route changes through it rather than deleting or reorganizing files directly.
- Tier 1: one plain-language architecture statement and the interactive visual explorer.
- Tier 2: selected-layer explanation, real product screenshots, and canonical source links.
- Tier 3: the systems that detect drift, enforce quality, require evidence, and publish safely.
- Hidden until requested: file-level rationale and deeper technical notes.
- Removal candidates: the current abstract ownership rows, duplicate assurance copy, KPI cards, decorative status badges, and repository controls.
- Failure-loudly behavior: every technical claim names its canonical source; generated-map and publish systems name their detection command.

## Acceptance Criteria

- [x] The page leads with a title and description that explain the purpose in plain language.
- [x] A keyboard-accessible file tree represents the actual repository layers and updates a selected-layer inspector.
- [x] The inspector explains purpose, boundaries, examples, and canonical source evidence without presenting mutation controls.
- [x] Real application screenshots connect code layers to visible product outcomes.
- [x] A lower section explains the systems that keep architecture organized and clean going forward.
- [x] The existing Architecture Change Log remains discoverable without competing with the primary explorer.
- [x] Desktop and mobile layouts remain readable with no horizontal overflow.
- [x] The final page contains no KPI cards, nested cards, decorative dashboard modules, or GitHub deletion controls.

## Implementation Checklist

- [x] Full task process, Linear issue, and owned paths are established before product edits.
- [x] Existing shared layout, file-tree, split-page, and link primitives are reused.
- [x] Architecture content is isolated from interaction code and covered by focused tests.
- [x] Generated project-map outputs are refreshed after the architecture route changes.
- [x] Selected-layer state is keyboard and pointer accessible.
- [x] Mobile uses progressive disclosure rather than compressing a desktop inspector.
- [x] Database, auth, provider, permission, and deployment contracts remain unchanged.

## Integration and Verification

- [x] Focused unit tests cover default selection, layer switching, evidence links, and absence of mutation controls.
- [x] Targeted lint, route, changed-type, unsafe-pattern, and architecture drift checks pass.
- [x] The exact authenticated route is exercised with pointer and keyboard interaction.
- [x] Desktop and mobile screenshots are captured and visually reviewed.
- [x] Independent reviewer approves the visual hierarchy and evidence fidelity.
- [x] Verification manifest/result pair passes with `--require-pass`.
- [x] Screenshot evidence is attached to AAI-1110.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: architecture claims without a canonical source, inaccessible layer selection, screenshot load failure, or generated-map drift.
- Detection path: focused interaction tests, image fallback coverage, authenticated browser proof, architecture map drift check, independent visual review, and verification contract.
- Recovery path: correct the source-backed content or shared interaction owner, rerun the focused checks, recapture the exact route, and republish through `codex:finish`.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: The first implementation optimized for proof-of-process text instead of the requested visual explanation of codebase strategy.
- Detection gap: Acceptance criteria did not require a file tree, screenshots, or an interactive explanation model.
- Prevention: Visual requests must name the required visual artifacts and interaction behavior in the task definition before implementation.
- Guardrail evidence: focused workspace test, shared split-page audit, exact-route interaction proof, four screenshots, and independent approval.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear intake | AAI-1110 | Pass | Corrective child issue created under AAI-1093. |
| Impeccable preflight | Product context, doctrine, noise gate, user-confirmed shape | Pass | Existing product screenshots will be used instead of generated concept art. |
| Focused regression | AI Dashboard workspace Jest | Pass | 7/7 tests, including interactive architecture selection and read-only safety. |
| Targeted static checks | ESLint, route check, changed-file type guard, unsafe-pattern guard | Pass | No task-owned static failures. |
| Generated architecture maps | `map:project -- --check-only`, `map:system -- --check-only` | Pass | Project and system maps are current. |
| Impeccable audits | Surface complexity and split-page consistency | Pass | Shared file-tree and SplitPage owners are used; no nested-card or popup violations. |
| Browser interaction | `browser-proof.md` | Pass | Pointer, keyboard, mobile detail/back, real images, source links, zero mutation controls, and 390px overflow readback pass. |
| Visual evidence | Four exact-route screenshots | Pass | Desktop explorer, product/process, mobile tree, and mobile inspector are attached to AAI-1110. |
| Independent review | `independent-review.md` | Approved | Visual hierarchy, evidence fidelity, responsive behavior, and noise gate approved. |
| Verification contract | `verify:contract --require-pass` | Pass | PASS is supported by declared evidence. |
| Publication | `npm run codex:finish -- --message "Build interactive architecture explorer" --staged-only ...` | Pass | Revision `505164ebdbe3059c8f3e0cc7ad12259e57a4d16c` published to `origin/main` with local/remote equality. |
| Linear closeout | AAI-1110 completion comment `c5fa610f-4a7d-4e03-b387-2deb3afc3223` | Pass | Evidence summary posted and issue moved to Done. |
| Full frontend typecheck | `cd frontend && npm run typecheck` | Unrelated fail | Broad existing diagnostics; no observed diagnostic touched AAI-1110-owned files. |

## Remaining Risk

- Architecture facts can drift if copied instead of linked to canonical owners. Owner: architecture task session. Prevention: keep the page concise and attach every technical claim to its source or deterministic check.

## Browser Comment Follow-up: Repository Label

- [x] The stale hard-coded `alleato-procore/` tree label is replaced with `alleato-pm/`.
- [x] The exact authenticated Architecture route visibly renders `alleato-pm/`.
- [x] A focused regression assertion requires `alleato-pm/` and rejects `alleato-procore/`.
- [x] Targeted Jest, ESLint, surface-complexity audit, and diff checks pass.
- [x] Independent read-only review approves the two-file change and screenshot.
- [x] The scoped follow-up is published and local `HEAD` equals `origin/main`.

Follow-up root cause: the repository display name was a page-local string without a focused assertion. The browser comment detected the stale label; the regression test now prevents it from silently returning.

Follow-up publication: revision `b70e962d5f4b712d123f4f0bfaec431bb00a2de9` published the corrected label, regression guardrail, exact-route screenshot, browser proof, and independent review to `origin/main`.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is captured for the corrective redesign.
- [x] Deferred automation includes cause, detection gap, prevention, owner, and next action.
