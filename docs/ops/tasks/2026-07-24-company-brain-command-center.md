# Task: Company Brain Command Center

Status: Complete
Owner: Codex S2401
Created: 2026-07-24
Task ID: local-company-brain-command-center
Delivery lane: High-risk

## Objective

Ship the canonical `/ai/company-brain` experience as an accessible, responsive,
permission-scoped command center for Sources → Company Brain → Agents → Outcomes.

## Design-source limitation

`design/experience-system/EXPERIENCE_SYSTEM.md` and
`design/experience-system/IMPLEMENTATION_PLAYBOOK.md` are absent. The
implementation uses the supplied Company Brain specification and implementation
guide plus the repository's existing PRODUCT/DESIGN system. No parallel design
system or unrelated token set will be introduced.

## Reference-parity correction

The first published composition was rejected because it reduced the supplied
command-center reference to a generic four-column topology and omitted the
reference's operational content. The divergence was localized at the
UI-contract-to-DOM boundary, not authentication or data loading. This correction
restores five ingestion sources, central knowledge growth and Company Brain, six
intelligence outputs, five pipeline stages, live activity, top connections, six
monitoring trends, and system insights/coverage. The deterministic fixture
carries reference-like values; production mode never substitutes fixture values
for unsupported backend measures.

The production readback additionally normalized live data into the same five
canonical source lanes and six canonical output lanes. Observed source counts
remain permission-scoped; unobserved integrations and unsupported outputs render
as unmeasured instead of inheriting raw ingestion identifiers or fixture values.

The second visual correction was localized to the presentation boundary. The
data contract and flow order were correct, but generic Lucide source glyphs, a
small symbolic brain core, a duplicated AI workspace shell, and excess framing
made the result visually unrelated to the supplied reference. The corrected
surface uses real Fireflies and Microsoft product marks, an optimized
transparent neural-brain asset with the Alleato mark, colored deterministic
flow lanes, the canonical expanded application sidebar, and a single page
heading. No backend or permission contract changed.

Browser review removed the unsupported “Knowledge growth (24h)” headline from
the central map. The backend still has no authoritative growth measure, but the
surface no longer promotes that missing metric. An E2E assertion and refreshed
1440 visual baseline prevent the headline from returning.

## Acceptance contract

- [x] `/ai/company-brain` is canonical and the legacy route redirects without
      losing shareable query state.
- [x] The server boundary requires an active internal employee and reads through
      the authenticated RLS-scoped Supabase client.
- [x] Restricted entity names, counts, and activity do not reach serialized
      props, the DOM, or telemetry.
- [x] The page renders an accessible SVG/HTML map and an equivalent textual
      list/tree.
- [x] Selection updates `?focus=kind:id`; close and browser Back restore focus.
- [x] Screens below 768 px render Sources → Brain → Agents → Outcomes story mode.
- [x] Loading, first-run empty, no-results, partial failure, full failure, and
      permission-limited states fail loudly with recovery.
- [x] Positions and fixtures are deterministic.
- [x] Reduced motion disables autonomous visual motion.
- [x] The Playwright matrix covers desktop, tablet, mobile, keyboard, Back,
      screen-reader alternative, reduced motion, states, permission safety, and
      stable visual snapshots.

## Canonical reuse

- Route/page shell: canonical `PageShell`, global `AppSidebar`, `SiteHeader`,
  `WorkspacePageIntro`, and `WorkspaceSection`. The duplicate page-local AI
  workspace shell was removed.
- Controls and feedback: shared `Button`, `ExpandableSearch`, `Sheet`, and
  `Alert`.
- Existing semantic and AI Dashboard route tokens.
- Existing `requireBrainUser()` and business-area RLS policies.
- Source identity: locally served official integration marks; the central neural
  visualization is a generated, optimized transparent WebP overlaid with the
  repository's existing Alleato mark.

## Data contract and gaps

- Real sources: `document_metadata`.
- Real agent catalog/status: `ai_agents`.
- Real work and activity: `tasks` plus permitted document activity.
- No authoritative knowledge-coverage score, Company Brain endpoint, persisted
  topology, agent-run health stream, or source retry command exists.
- Missing authority is represented as `unknown`/unavailable; no live value or
  action is fabricated.

## Failure-loudly contract

- Cause: each server source returns a named source failure without serializing
  inaccessible rows.
- Detection: focused loader tests, state tests, Playwright permission-safety
  assertions, and browser console checks.
- Recovery: retry the page/query, open the canonical pipeline source, or request
  access through the existing denial route.
- Prevention: the UI consumes only normalized permission-scoped contracts, and
  telemetry accepts enum-only fields.

## Debugging closeout

- Cause: the first isolated browser runs reused port 3000 from the canonical
  checkout, then the correct temp worktree exposed malformed Webpack development
  chunks because its ignored `node_modules` junction resolved outside the
  worktree filesystem root.
- Detection gap: the first test helper waited for server-rendered visibility,
  which allowed a visible but non-hydrated map to look ready.
- Prevention: interactive controls remain disabled and `aria-busy` until client
  handlers attach; Playwright waits for enabled controls; the focused config
  derives its server port from `PLAYWRIGHT_BASE_URL`; final proof used Turbopack
  with a temporary common verification root containing the worktree and
  dependency target.
- Guardrail: keyboard, Back, mobile focus restoration, and responsive pan/reset
  are explicit browser assertions.
- Browser-test origin cause: `127.0.0.1` pages intermittently reloaded
  `localhost` development chunks across origins, leaving server-rendered controls
  intentionally disabled before hydration. Running the matrix on Next's
  canonical `localhost` origin removed the cross-origin boundary; the hydration
  guard remains in product code.
- Visual regression cause: the first parity pass tested its own output but did
  not assert the reference's defining assets.
- Visual regression detection gap: generic source icons and a placeholder brain
  could still satisfy content and accessibility assertions.
- Visual regression prevention: E2E now asserts the Fireflies, Outlook, and
  neural-brain asset paths; desktop/mobile snapshots make the expanded shell,
  flow topology, and centerpiece reviewable.
- Browser-review correction: the Knowledge Flow section now sits directly on
  the page canvas without its former outer fill, border, or radius. The bounded
  source, outcome, pipeline, and right-rail controls remain unchanged.
- Browser-review guardrail: the primary E2E asserts a transparent panel with a
  zero-width border, and the 1440 visual baseline records the simplified shell.
- Status-label correction: `Live` and `System Healthy` are passive status text,
  not controls. Their fill, border, radius, minimum height, and horizontal
  padding were removed while retaining the semantic status indicators.
- Pipeline contract correction: the former Collected → Processed → Chunked →
  Embedded → Structured row was a conceptual visualization, not the canonical
  backend contract. `backend/src/services/pipeline/orchestrator.py` and its
  regression test define Parser → Embedder → Extractor as the three pipeline
  stages. Company Brain now mirrors those names.
- Pipeline authority gap: the permission-scoped Company Brain loader does not
  receive authoritative per-stage counts or completion state. Live mode
  therefore renders neutral markers and `Live status unavailable`; only the
  deterministic review fixture shows stable example counts and completion
  checks.
- Pipeline visual correction: individual arrow icons were replaced by a quiet
  continuous connector rail, and the localized pipeline module regained its
  reference-aligned `Pipeline stages` label.

## Supabase type-gate note

The required type generation command was attempted before data work. The
sandboxed and escalated `npx supabase gen types` attempts exited before producing
types, and the Supabase connector denied type generation. The redirected partial
file was restored byte-for-byte. This task adds no direct table query or schema
change; the Company Brain loader composes existing typed Brain loaders and their
authenticated RLS boundary.

## Evidence

| Check                      | Command or artifact                                                                                              | Result                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                  | Direct `tsc --noEmit --pretty false --incremental`                                                               | Repo-wide exit 2 with 618 existing diagnostics; 0 diagnostics in task-owned files. The package script is also Windows-incompatible because it invokes `rm`.                                                           |
| Lint                       | Targeted `eslint` over the corrected Company Brain source, fixture, contract, data loader, and shared page intro | Pass.                                                                                                                                                                                                                 |
| Focused unit tests         | Jest normalized contracts, real-loader permission redaction, and route rendering                                 | 3 suites, 13 tests passed.                                                                                                                                                                                            |
| Playwright matrix          | Focused Company Brain config and Chromium project                                                                | Pass: authenticated setup plus 8 feature tests (9/9), including Axe, keyboard, Back, 1024/768, 375, reduced motion, all states, and permission redaction.                                                             |
| Visual regression          | Stable 1440 and 375 snapshots                                                                                    | Pass: authenticated setup plus two regenerated-and-rechecked snapshots (3/3).                                                                                                                                         |
| Browser review correction  | Selected Knowledge Flow outer shell                                                                              | Pass: outer background and border removed; targeted E2E CSS assertions pass and the 1440 baseline was regenerated.                                                                                                    |
| Status and pipeline review | Passive status labels and canonical pipeline                                                                     | Pass: targeted E2E asserts transparent/borderless statuses and Parser → Embedder → Extractor; the regenerated 1440 snapshot records the connector rail.                                                               |
| Production build           | `next build --no-lint --experimental-app-only` with 7,168 MB heap                                                | Blocked by reproducible repo-wide V8 heap OOM before source validation; no Company Brain compiler error identified.                                                                                                   |
| Surface complexity audit   | Alleato product noise gate against final page                                                                    | Pass for an explicitly requested monitoring dashboard: every module maps to the supplied reference and a monitoring decision; there are no nested cards, helper widgets, duplicate CTAs, or fabricated live measures. |
| Responsive screenshots     | `company-brain-1440-chromium.png`, `company-brain-375-chromium.png`                                              | Pass; behavioral assertions additionally prove 1024 and 768 layouts.                                                                                                                                                  |
| Independent review         | Reviewer audit plus focused re-review                                                                            | Accepted after privacy, tablet, recovery, identity, and stale agent-placeholder findings were fixed and regression guarded.                                                                                           |
| Publication                | Initial Company Brain publication `acfe2e4ba`; reference-parity correction tracked by this task                  | The initial publication was superseded after user review. The correction is published through the repository finish flow and its commit is reported in the final task response.                                       |

## Final status

- [x] Acceptance contract complete.
- [x] Focused regression tests pass.
- [x] End-to-end evidence captured.
- [x] Independent review accepted.
- [x] Exact task-owned files published to `origin/main`.
