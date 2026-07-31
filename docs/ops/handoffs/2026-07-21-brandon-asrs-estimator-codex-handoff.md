# Brandon Handoff: Phase 1 ASRS Estimator

**Prepared:** July 21, 2026  
**Domain owner taking over:** Brandon  
**Historical planning references (optional; no Linear access required):** AAI-1215 and AAI-1223
**GitHub progress tracker:** [Issue #74 — ASRS Estimator — Brandon progress tracker](https://github.com/The-Alleato-Group/project-management/issues/74)

**Current status:** The FMDS0834 source-review and embedding prerequisites are complete. Brandon's prototype review remains the next gate, and the Phase 1 calculator described here is not yet implemented. Decision 1 was posted directly to Brandon on GitHub issue #74 on July 22, 2026.

## No Megan/Linear dependency

Brandon and his Codex session do **not** need access to Megan Harrison's Linear workspace. This document is the complete handoff and contains the decisions needed to continue.

- Linear links are provenance only. They are never a prerequisite.
- If Linear returns unauthorized, unavailable, or not found, Codex must continue from this document without retrying or blocking.
- Brandon's Codex should not open any `linear.app` link in this document unless it already has a configured, working connector.
- New answers from Brandon belong in [`2026-07-21-brandon-asrs-estimator-decision-log.md`](./2026-07-21-brandon-asrs-estimator-decision-log.md).
- After every session, Codex must post the required progress summary to [GitHub issue #74](https://github.com/The-Alleato-Group/project-management/issues/74), including the pushed commit SHA or an explicit no-code status.
- If Codex cannot write to the repository yet, it should maintain the same decision-log headings in the task and produce a complete Markdown update before the session ends.
- Do not send Brandon back to Megan for access or answers.

## What Brandon should give Codex

Open a new Codex task in the Alleato `project-management` repository and paste the prompt below. Also attach this document if Codex cannot read it from the repository.

```text
Use the Wayfinder skill. You are taking over the Phase 1 ASRS Estimator directly with me, Brandon, as the domain owner.

Read docs/ops/handoffs/2026-07-21-brandon-asrs-estimator-codex-handoff.md completely before doing anything. It is the self-contained product contract.

Do not require or wait for access to Megan Harrison's Linear workspace. The Linear links are optional historical references only. If they are inaccessible, continue normally and do not retry them.

Work with me directly. Do not ask Megan to answer ASRS, fire-protection, rack-layout, fabrication, material, or supplier-pricing questions. Ask me one concrete domain question at a time, include your recommendation and why, and record my answer in docs/ops/handoffs/2026-07-21-brandon-asrs-estimator-decision-log.md. If you cannot write that file, maintain the same log in this Codex task and give me a complete Markdown copy before ending.

At the end of every session, post a checkpoint comment to https://github.com/The-Alleato-Group/project-management/issues/74 with the decisions made, what changed, files and commit SHA, verification, blockers, what remains, and the exact next step. If no files changed, say that explicitly. This GitHub issue is how Megan follows progress without being the intermediary.

Start with the prototype-review milestone described in this handoff. Walk me through its review questions one at a time. Do not implement the new calculator until I have accepted or corrected the prototype and you have completed the final implementation-sequence milestone described here.

For Phase 1:
- support one uniform rack configuration per estimate;
- use manual structured input only;
- do not add PDF or DWG upload support;
- do not connect this to Drawings, Documents, Specs, OCR, RAG, chat, estimating approvals, or downstream workflows;
- treat the user as any authorized Alleato project user;
- fail closed when reviewed FMDS evidence, geometry, recipes, or exact quote pricing are missing;
- never turn retrieved text, vector search, an unreviewed figure, or an engineering assumption into a calculated quantity.

Before editing, read the repository's current AGENTS.md, use the registered canonical main checkout/writer lease unless Megan has explicitly preserved the ASRS worktree exception, and verify the checkout is clean and current. Publish small, focused checkpoints frequently so the work is not stranded locally. Follow the repository task, migration, verification, screenshot, and finish gates when implementation begins. Mirror decisions to Linear only if a configured connector is already available; lack of Linear access is never a blocker.
```

## The product Brandon asked for

Phase 1 is a manual, deterministic ASRS takeoff and quote-backed estimating tool.

An authorized Alleato project user enters one uniform ASRS rack-run configuration, including the rack/system arrangement, protected run, levels and horizontal lines, qualifying transverse-flue locations, pipe profile, and material choices. The system uses only reviewed, revision-locked FMDS rules to generate explicit sprinkler coordinates. It then counts heads and outlets from those coordinates, partitions pipe into fabricated pieces using an explicit fabrication profile, applies reviewed material recipes, and prices eligible items from reviewed supplier quote lines.

Every number must explain where it came from. If an input or approved source is missing, the dependent result must remain nonnumeric and state exactly what blocks it.

### Brandon's original test case

Brandon described a roughly 200 ft run with transverse flues at a uniform pitch:

- At a 2.5 ft pitch, every other qualifying flue is 5 ft apart and can satisfy a reviewed rule whose maximum actual spacing is 5 ft.
- At a 2.75 ft pitch, every other qualifying flue is 5.5 ft apart and fails that rule.
- The system must not silently switch the second case to every-flue protection. A fallback is allowed only if a reviewed rule explicitly defines it.
- A 200 ft pipe line using a selected 20 ft fabrication profile produces 10 fabricated pieces per line, including any explicitly handled partial final piece.
- The number of outlets on each piece must be assigned from the actual generated coordinates. It is not automatically 10 outlets per piece.

This distinction matters. With the illustrative prototype inputs—2.5 ft flues, protection at every other station, and a 20 ft piece—there are four generated outlet positions per full piece, not ten. If actual practice expects a different result, Brandon must correct the geometry, phase, endpoint, or fabrication assumptions; the software must not force the answer to match an anecdotal shortcut.

## Phase 1 boundaries already decided

These are locked decisions. Do not reopen them unless Brandon identifies a factual error or explicitly changes the Phase 1 scope.

| Area | Locked Phase 1 decision | Historical reference (optional) |
|---|---|---|
| User | Any authorized Alleato project user may enter and evaluate a configuration. Permissions and approval roles are not a Phase 1 concern. | [AAI-1216](https://linear.app/megankharrison/issue/AAI-1216/decide-the-phase-1-estimating-workflow-and-approval-boundary) — canceled as out of scope |
| Configuration scope | One uniform rack configuration per estimate. A materially different geometry is a separate estimate/project in Phase 1. | [AAI-1217](https://linear.app/megankharrison/issue/AAI-1217/define-the-canonical-asrs-geometry-and-alignment-model) |
| Manufacturer scope | The data model is extensible. Exotec may be an initial example, but the calculator must not hard-code Exotec as the only system. | [AAI-1217](https://linear.app/megankharrison/issue/AAI-1217/define-the-canonical-asrs-geometry-and-alignment-model) |
| Data entry | Manual structured entry only. No PDF upload, PDF prefill, DWG reading, automatic takeoff, or layout generation in Phase 1. | [AAI-1219](https://linear.app/megankharrison/issue/AAI-1219/decide-the-phase-1-pdf-assisted-input-boundary) |
| Workflow integration | No connection to Drawings, Documents, Specs, OCR, RAG, chat, estimating approvals, or other Alleato workflows for now. | [AAI-1215](https://linear.app/megankharrison/issue/AAI-1215/wayfind-phase-1-asrs-takeoff-and-quote-backed-estimating) |
| FMDS evidence | Only active, revision-locked, visually reviewed tables/figures and approved rule cards can produce quantities. Retrieval/vectorization is discovery evidence, not calculation authority. | [AAI-1220](https://linear.app/megankharrison/issue/AAI-1220/define-the-phase-1-fmds-evidence-and-fail-closed-boundary), [AAI-1227](https://linear.app/megankharrison/issue/AAI-1227/specify-the-fmds-horizontal-iras-template-review-contract) |
| Geometry | Use explicit rows, levels, horizontal lines, qualifying flue stations, coordinates, endpoints, and pipe segments. Run length divided by spacing is not a valid head-count contract by itself. | [AAI-1217](https://linear.app/megankharrison/issue/AAI-1217/define-the-canonical-asrs-geometry-and-alignment-model) |
| Calculation | Expand stations, generate explicit sprinkler-position records, then count the records. Use exact unit-tagged decimal inches internally. Do not silently deduplicate or repair conflicts. | [AAI-1221](https://linear.app/megankharrison/issue/AAI-1221/define-the-deterministic-asrs-takeoff-calculation-contract) |
| Origin and endpoints | The user confirms the reference end and first protected flue. Validate the chosen phase and last bay. Do not silently optimize the phase, move the first head, or add an endpoint head. | [AAI-1230](https://linear.app/megankharrison/issue/AAI-1230/decide-phase-1-iras-origin-alternating-phase-and-endpoint-policy) |
| Fabrication | Fabrication profiles are explicit and versioned. Stick length is required/editable; 20 ft is not universal. Partition from the confirmed start, preserve a partial last piece, and do not reuse offcuts automatically. | [AAI-1229](https://linear.app/megankharrison/issue/AAI-1229/define-the-phase-1-fabricated-pipe-and-material-recipe-policy) |
| Outlet ownership | Use half-open piece intervals `[start, end)`, with the final piece including the terminal end. A boundary outlet belongs to the downstream piece. Keepout conflicts fail explicitly; never move the outlet or joint automatically. | [AAI-1229](https://linear.app/megankharrison/issue/AAI-1229/define-the-phase-1-fabricated-pipe-and-material-recipe-policy) |
| Material recipes | The base reviewed mapping is one approved sprinkler position to one head and one welded outlet. Extra fittings/materials require an explicit reviewed topology or recipe. No automatic waste, spare, or fitting percentage. | [AAI-1229](https://linear.app/megankharrison/issue/AAI-1229/define-the-phase-1-fabricated-pipe-and-material-recipe-policy) |
| Pipe sizing | The user selects diameter, schedule, and material. Phase 1 does not perform hydraulic sizing or sealed engineering design. | [AAI-1229](https://linear.app/megankharrison/issue/AAI-1229/define-the-phase-1-fabricated-pipe-and-material-recipe-policy) |
| Supplier pricing | Use reviewed, source-linked quote versions and exact item matching only. No fuzzy match, inferred unit price, zero substitution, or silent cheapest-vendor mix. | [AAI-1222](https://linear.app/megankharrison/issue/AAI-1222/define-supplier-quote-normalization-and-price-selection) |
| Price selection | The user selects a quote scenario or explicit supplier per line. A partially priced scenario stays partial and cannot be ranked as cheaper. Tax/freight apply only when explicitly supported. | [AAI-1222](https://linear.app/megankharrison/issue/AAI-1222/define-supplier-quote-normalization-and-price-selection) |
| Ordered quantity | Required takeoff quantity and pack-rounded/ordered quantity are separate values. | [AAI-1222](https://linear.app/megankharrison/issue/AAI-1222/define-supplier-quote-normalization-and-price-selection) |
| Phase 2 | DWG/PDF automation, mixed configurations, exceptional projects, and downstream workflow integration may be considered later. They must not distort Phase 1. | [AAI-1215](https://linear.app/megankharrison/issue/AAI-1215/wayfind-phase-1-asrs-takeoff-and-quote-backed-estimating) |

The concise product contract is also recorded in [`docs/architecture/README-ASRS-INTELLIGENCE.md`](../../architecture/README-ASRS-INTELLIGENCE.md).

## Governing FMDS evidence and current limitation

The source under review is **FMDS 8-34, April 2026**:

- Local source supplied by Megan: `/Users/meganharrison/Downloads/FMDS0834 - 2026.pdf`
- Document code/revision: `FMDS0834 / 2026-04`
- SHA-256: `c6f78457ac452c1c4c95b8d195ab5f33a5a772a4ebaf7d0e5ff28c055d8411ed`
- Shuttle ASRS, closed-top: Table/Figures 2.2.3.2.1(a-e), PDF pages 34-37
- Shuttle ASRS, open-top: Table/Figures 2.2.4.2.1(a-e), PDF pages 51-53
- Mini-load ASRS, closed-top: Table/Figures 2.2.6.2.1(a-e), PDF pages 65-68
- Mini-load ASRS, open-top: Table/Figures 2.2.7.2.1(a-e), PDF pages 80-82

The open-top evidence includes applicable sprinkler placement within 3 in. of every other qualifying transverse flue, with actual on-line spacing not exceeding 5 ft. That supports the 2.5 ft-versus-2.75 ft boundary example, but it does not independently establish endpoints, alternating phase, or a universal every-flue fallback.

**Current hard stop:** all 58 FMDS0834 tables and 60 real figures have now been source-reviewed and embedded with exact revision, page, candidate, and approval provenance. The page-43 table-cell false-positive that duplicated figure-like text was removed after dependency proof. However, there is still no approved horizontal-IRAS head-count rule card, and Brandon has not accepted the manual geometry/fabrication contract. Reviewed retrieval evidence alone does not authorize a numeric head count. Until both gates are resolved, the production calculator must keep head count and dependent BOM/pricing nonnumeric and Pending Review.

## Supplier corpus status

The quote inventory is documented in [AAI-1218 — Inventory the supplier-quote corpus and pricing dimensions](https://linear.app/megankharrison/issue/AAI-1218/inventory-the-supplier-quote-corpus-and-pricing-dimensions).

- The transcript's “Equifier” most likely refers to Accu-Fire.
- Core & Main, Ferguson, and Winsupply have at least some itemized line prices.
- Current Accu-Fire PDFs omit line prices.
- Bassett and Impact material are lump-sum proposals.
- The Mack source is opaque in the current inventory.

Only immutable, reviewed artifact versions with extractable, exact line prices are price-eligible. A lump-sum proposal must remain lump sum; Codex must not manufacture unit prices by dividing it across materials.

## What the current prototype is—and is not

This section is the complete prototype specification. No Linear document, screenshot, or file from Megan's computer is required for Brandon's review.

The prototype demonstrates a proposed **dedicated full-page result after “Evaluate configuration,” with “Edit inputs” returning to the preserved manual form**. It shows a review chain from input geometry through rule selection, generated coordinates, fabrication, BOM, and quote scenarios.

The proposed result page is a quiet, review-first page in this order:

1. Page title, evaluation state, configuration name, and one `Edit inputs` action.
2. Preserved input snapshot: system/rack family, top condition, wet/dry class, run endpoints, levels, horizontal lines, qualifying-flue origin/pitch/count, pipe diameter/schedule/material, and fabrication profile.
3. Governing evidence: exact FMDS revision, table, figure/template, review state, and source pages.
4. Calculation trace: expanded flue stations, selected every-other phase, exact generated sprinkler coordinates, endpoint validation, and per-line/per-level multiplication.
5. Fabrication trace: line bounds, piece intervals, partial final piece, outlet-to-piece ownership, and keepout conflicts.
6. BOM table: item, source recipe/topology, required quantity, ordered quantity, unit, and blocked reason where applicable.
7. Supplier scenarios: one explicit quote basis per scenario, source quote version, exact matched lines, freight/tax only when supported, partial-pricing state, and total.
8. Unresolved or blocked outputs with the exact fact and review action needed.

This is not a dashboard. It has no KPI cards, decorative summary tiles, duplicate primary actions, or unrelated workflow widgets.

The sample fixture is illustrative:

- Exotec shuttle, open-top, wet system
- 200 ft protected run
- Three in-rack levels
- One logical horizontal line per sample level
- First qualifying flue at 2.5 ft
- 80 qualifying stations at a 2.5 ft pitch
- Every-other-flue phase beginning at the confirmed first station
- 2 in. Schedule 10 pipe
- 20 ft selected fabrication profile
- 40 sprinkler positions per horizontal line
- 120 sprinkler positions across the three sample lines
- 600 ft total horizontal pipe
- 30 fabricated pieces
- Four outlets on each full piece for this particular geometry

**All dollar amounts and supplier totals displayed in the prototype are illustrative placeholder numbers.** “Illustrative prices” means they exist only to demonstrate the layout and comparison behavior. They are not extracted from, matched to, or approved against a real supplier quote and must never be presented as live pricing.

## Brandon's immediate review

Codex should use the self-contained prototype specification above and work through these questions one at a time. It must not attempt to open AAI-1223 unless Linear access is already configured:

1. Does the proposed manual configuration capture the information Brandon actually has when estimating a real job?
2. Are the meanings of rack row, ASRS level, horizontal sprinkler line, qualifying transverse flue, first protected flue, and protected-run endpoints correct?
3. Is multiplying an explicit per-line coordinate set across the entered rows/levels/lines the right real-world model, or is another dimension needed?
4. Does the calculation explanation make it obvious why 2.5 ft can pass an every-other 5 ft maximum while 2.75 ft fails it?
5. Is it correct that the sample geometry yields four outlets per 20 ft piece, rather than assuming ten outlets on every piece?
6. Does the BOM contain the material categories Brandon expects? Which items must come from geometry/topology, and which are intentionally manual?
7. Are separate supplier scenarios and explicit line-level supplier choices the correct way to compare prices without silently mixing vendors?
8. Should results live on a dedicated result page after evaluation, with “Edit inputs” returning to the preserved form? This is the current recommendation.
9. What wording would make a blocked/unreviewed calculation understandable without suggesting that the system has made an engineering determination?

For each correction, Codex must record the exact decision and resulting contract change in [`2026-07-21-brandon-asrs-estimator-decision-log.md`](./2026-07-21-brandon-asrs-estimator-decision-log.md). When Brandon accepts the prototype, Codex marks Milestone 1 accepted in that file and moves to Milestone 2. If Linear is available, Codex may mirror the result to AAI-1223, but the repository log is sufficient to continue.

## Remaining decision sequence

Only two sequential decision milestones remain. The AAI numbers are historical identifiers, not access requirements:

1. **AAI-1223 — prototype review:** Brandon accepts or corrects the proposed manual-to-result workflow and calculation explanation.
2. **Implementation sequence and acceptance evidence (historical ID AAI-1224):** after prototype review is resolved, define the implementation slices, dependencies, test fixtures, review responsibilities, and end-to-end acceptance evidence.

Work one milestone at a time. Do not start the implementation-sequence milestone while prototype review remains unresolved. Do not start implementation while these product decisions are still open. Track both milestones in the repository decision log whether or not Linear is available.

## Current repository implementation: do not mistake it for Phase 1 completion

The authenticated `/fm-global` surface currently contains an older UI-first “reviewed Batch 1” FMDS evaluator. Its request contract asks for ceiling sprinkler type, design sprinkler count, and transverse-flue adequacy inputs. It returns verified/pending requirements from the corpus.

That existing evaluator is useful infrastructure and evidence of the fail-closed review pattern, but it is **not** the manual ASRS geometry, deterministic head-count, fabrication, BOM, and supplier-pricing workflow described in this handoff.

Canonical current owners include:

- `frontend/src/app/(main)/fm-global/page.tsx`
- `frontend/src/app/(main)/fm-global/fm-global-dashboard-client.tsx`
- `frontend/src/app/(main)/fm-global/asrs-estimator.tsx`
- `frontend/src/components/fm-global/asrs-estimator-results.tsx`
- `frontend/src/app/api/fm-global/estimator/evaluate/route.ts`
- `frontend/src/lib/fmds/asrs-estimator.ts`
- `frontend/src/lib/fmds/asrs-estimator.server.ts`
- `frontend/src/lib/fmds/asrs-rest.server.ts`
- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/page.tsx`
- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/review-form.tsx`
- `frontend/src/app/api/fmds/tables/[tableId]/review/route.ts`
- `frontend/src/types/asrs-database.types.ts`
- `docs/architecture/README-ASRS-INTELLIGENCE.md`

Before designing new UI or data access, inspect these owners and reuse the canonical route, primitives, evidence adapters, and review-status patterns. Do not copy the existing estimator and create a disconnected parallel surface.

## Repository and checkout instructions

This handoff is portable. Brandon's Codex should work from the root of its own `The-Alleato-Group/project-management` clone; it must not depend on a path, worktree, branch, or credential that exists only on Megan's computer.

The current repository rule is one registered canonical checkout on `main` with a single writer lease. The old local `feat/asrs-intelligence` worktree is historical and is not a remote dependency. Do not create or switch to a task branch/worktree unless Megan has provided a new explicit exception with an owner and expiry.

Start every new session with read-only checks from the repository root:

```bash
git fetch origin main
git status --short
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git rev-list --left-right --count origin/main...HEAD
node scripts/ops/checkout-session-gate.mjs status
```

Before the first product edit, follow the current `AGENTS.md` instructions to register the clean canonical `main` checkout if needed and claim the writer lease for the exact ASRS task-owned paths. If the checkout is dirty, on the wrong branch, or leased to another session, preserve that state and resolve ownership; do not stash, reset, create a worktree, or switch branches to bypass the gate.

During implementation, make focused commits and publish checkpoints frequently to `origin/main`. Codex must use the current `AGENTS.md` finish flow, reconcile any moved `origin/main`, verify the intended commit exists remotely before claiming it is pushed, and release the writer lease after finish or deliberate handoff.

## How Codex should work with Brandon

- Treat Brandon as the direct domain decision-maker for this project.
- Do not route questions through Megan.
- Ask one answerable question at a time; avoid a long questionnaire.
- State the current evidence, explain the consequence of each choice, and recommend a default.
- Record Brandon's answer in the repository decision log immediately. Mirror to Linear only when a configured connector is available.
- Keep unresolved engineering assumptions visible and fail closed.
- Do not ask permission questions about ordinary authorized-user access. The Phase 1 answer is “any authorized Alleato project user.”
- Do not propose PDF upload again. The Phase 1 answer is manual entry.
- Do not attach this estimator to unrelated Alleato workflows.
- If Brandon introduces mixed geometry, treat it as separate estimates in Phase 1 unless he explicitly changes the locked scope.
- If Brandon's expected number conflicts with coordinate math, show the explicit coordinates and identify the first differing assumption. Never tune a shortcut to produce the expected total.

## Implementation order after the two decision milestones

Milestone 2 should refine this sequence, but the current recommended dependency order is:

1. Approve the applicable FMDS table/figure evidence and encode immutable revision-scoped rule cards with boundary fixtures.
2. Define and migrate the canonical configuration, geometry, rule-card, recipe, quote-line, calculation-run, and result records. Generate and inspect Supabase types before database code.
3. Implement the pure coordinate-first geometry/rule engine with exact unit handling and deterministic fixtures.
4. Implement fabrication partitioning, outlet ownership, keepout validation, and material-recipe expansion.
5. Normalize immutable supplier quote versions and exact line matches; implement explicit pricing scenarios and partial-pricing behavior.
6. Replace/evolve the current `/fm-global` estimator into the accepted manual-input and dedicated-result journey using shared page/form/table primitives.
7. Add source citations, calculation trace, blocked-state recovery, and preserved input editing.
8. Verify the authenticated end-to-end flow with approved source data and attach desktop/mobile screenshots from the canonical route.
9. Complete the task markdown, repository decision evidence, optional Linear mirror, migration ledger, focused/full checks as required, and publish to `origin/main` with remote SHA readback.

## Acceptance standard for the eventual implementation

The implementation is not complete merely because a form renders or unit tests pass. End-to-end proof must show that an authorized user can:

1. Enter a complete uniform configuration manually.
2. Select an eligible reviewed FMDS revision/template.
3. See explicit generated coordinates and a reproducible head/outlet count.
4. See the correct 2.5 ft boundary pass and 2.75 ft boundary failure fixture without a silent fallback.
5. See fabricated pieces and outlet ownership derived from the selected profile and coordinates.
6. See a BOM whose material lines identify their reviewed recipe/topology source.
7. Apply exact, source-linked supplier quote scenarios without hidden vendor mixing or invented prices.
8. Distinguish required quantity, ordered quantity, unit price, extensions, freight/tax, partial pricing, and total.
9. Edit inputs without losing the entered configuration.
10. Receive a specific, nonnumeric blocked result whenever source review, geometry, recipes, or pricing evidence is insufficient.

Required verification includes focused deterministic tests, database/migration readback where applicable, authenticated browser verification on the canonical route, desktop and mobile screenshots attached to the task, and remote commit verification.

## Failure modes that must remain loud

- Inactive or mismatched FMDS revision
- Unreviewed or ambiguous governing table/figure
- Duplicate figure identifier
- Missing or conflicting rule card
- Incomplete station, origin, phase, endpoint, level, row, or line geometry
- Multiple applicable rules without an explicit selection policy
- Every-other spacing over the reviewed maximum
- Outlet on a joint/end keepout
- Sprinkler position that cannot map to exactly one pipe piece
- Missing or conflicting material recipe
- Quote line with an inexact product/unit/pack match
- Lump-sum or opaque proposal presented as unit pricing
- Partially priced scenario presented as a complete or cheaper total
- Any downstream quantity calculated from a blocked head count

For every failure, the UI must name the affected output, the exact missing/conflicting fact, and the action required to resolve it while preserving the user's inputs.

## Existing evidence and handoffs worth reading

- `docs/architecture/README-ASRS-INTELLIGENCE.md`
- `docs/ops/handoffs/2026-07-20-S201-asrs-estimator-ui-first.md`
- `docs/ops/handoffs/2026-07-20-S197-fmds-tables-page-source.md`
- `docs/ops/handoffs/2026-07-20-S198-fmds-figures-page-source.md`
- `docs/ops/handoffs/2026-07-20-S198-fmds-table-details-taxonomy.md`
- `docs/ops/handoffs/2026-07-20-S200-fmds0834-batch1-rule-cards.md`
- `docs/ops/handoffs/2026-07-20-S202-public-fm-global-2026-evaluator-cutover.md`
- `docs/ops/handoffs/2026-07-20-S203-ai-chat-fmds-2026-cutover.md`
- `docs/ops/handoffs/2026-07-20-S204-fmds0809-2026-corpus.md`
- `docs/ops/handoffs/2026-07-20-S205-fmds-review-details.md`
- `docs/ops/handoffs/2026-07-20-S208-fmds0834-vision-table-candidates.md`

These earlier artifacts are evidence and implementation history, not authority to expand the Phase 1 scope. If they conflict with the locked Wayfinder decisions above, the Wayfinder decisions and Brandon's recorded corrections govern.

## Exact next action

Brandon answers Decision 1 in [GitHub issue #74](https://github.com/The-Alleato-Group/project-management/issues/74#issuecomment-5040519553). Codex records the answer in the repository decision log and immediately asks Decision 2, one question at a time. Megan is not the intermediary.
