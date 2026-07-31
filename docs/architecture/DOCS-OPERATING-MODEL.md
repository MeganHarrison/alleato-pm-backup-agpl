# Docs Operating Model

This is the canonical operating model for Alleato documentation.

The goal is to stop treating docs generation, docs publication, Procore parity,
screenshots, app help, and AI-assistant guidance as separate systems. They
should be one pipeline with different modes.

## Core Rule

Procore is a reference source for coverage and expected workflow shape.
Alleato's live workflow capture is the source of truth for what the product
actually does today.

That means:

1. Procore tells us what docs probably need to exist and what the expected
   workflow may include.
2. Alleato capture proves what steps, fields, labels, and screens actually
   exist.
3. Published Alleato docs become the canonical user-facing explanation for both
   humans and AI tools.

## Canonical Source Order

Use sources in this order:

1. `docs/tutorials/**` capture artifacts
   - `manifest.json`
   - ordered screenshots
   - `session.webm`
   - route assertions and step order
2. Alleato runtime and code truth
   - live route behavior
   - real form fields and statuses
   - `training_docs`, `training_doc_steps`, `training_doc_assets`
3. Procore reference material
   - Supabase support-article RAG via `scripts/procore-docs-query.js`
   - `.claude/procore-manifests/**`
   - official Procore support site
4. Published Alleato documentation surfaces
   - `/knowledge/app`
   - docs-site pages when the target audience is external or hosted docs

If these disagree, the live Alleato workflow wins. Procore is not allowed to
overwrite real Alleato behavior.

## One System, Three Modes

Use the same operating model for three job types.

### 1. `create`

Use this when a doc does not exist yet.

Flow:

1. Identify the feature and route.
2. Pull Procore reference context to understand the expected workflow and doc
   inventory.
3. Capture the real Alleato flow with Playwright.
4. Generate an Alleato-only draft from the captured workflow plus Procore source
   context.
5. Review, clean, and publish into the app knowledge system.
6. Mark the doc status and record blockers or parity gaps.

### 2. `refresh`

Use this when a doc already exists but product behavior changed.

Flow:

1. Start from the existing doc slug and existing `training_docs` row.
2. Re-run capture on the live route.
3. Compare the new capture against the published steps and screenshots.
4. Re-compose the draft only if step order, fields, labels, statuses, or
   screenshots changed.
5. Re-publish and record what changed.

`refresh` should not create a second doc or a second source of truth. It should
update the existing doc contract.

### 3. `audit`

Use this when the job is parity review, QA, or stale-doc detection.

Flow:

1. Compare Alleato capture against Procore reference expectations.
2. Identify one of four outcomes for each item:
   - aligned
   - doc stale
   - product gap
   - capture blocked
3. Send product gaps to the engineering backlog.
4. Send doc-stale items back into `refresh`.
5. Record evidence and blockers on the doc record or audit artifact.

`audit` is not a separate docs system. It is the review mode of the same system.

## Canonical Tooling Split

Use the quietest reliable tool for each job.

### Use Playwright capture for canonical doc artifacts

Playwright is the correct default for:

- step-by-step screenshots
- walkthrough video
- route assertions
- deterministic workflow capture
- rerunnable refresh flows

Current repo seam:

- `npm run tutorial:capture -- scripts/tutorials/workflows/<workflow>.workflow.ts ...`

### Use Procore RAG for reference, not final truth

Use `scripts/procore-docs-query.js` and `.claude/procore-manifests/**` to:

- map what docs should exist
- discover expected form fields, tabs, and statuses
- identify likely missing features
- enrich draft wording and workflow context

Do not publish Procore text directly. The composer must sanitize brand mentions,
links, and source-only behavior.

### Use `agent-browser` for exploratory verification

Use `agent-browser` when the task is:

- discovering a route
- checking a workflow manually
- investigating a blocker
- validating a narrow visible behavior quickly

Do not make `agent-browser` the canonical screenshot generator for final docs
unless the Playwright path is blocked and that exception is recorded.

## Current Implemented Pipeline

The repo already has the correct backbone:

1. Capture:
   - `scripts/tutorials/tutorial-recorder.ts`
   - `scripts/tutorials/run-tutorial.ts`
2. Compose:
   - `scripts/tutorials/compose-training-doc.mjs`
3. Publish:
   - `scripts/tutorials/publish-tutorial.ts`
   - `scripts/tutorials/promote-to-alleato-docs-site.mjs`
4. Store and render:
   - `training_docs`
   - `training_doc_steps`
   - `training_doc_assets`
   - `/knowledge/app`

This means the right move is not to invent a new docs engine. The right move is
to make this pipeline the only approved path and extend it cleanly.

## What The Skill Should Own

The `repeatable-training-docs` skill should become the operator guide for the
whole pipeline.

It should own:

- mode selection: `create`, `refresh`, `audit`
- required inputs
- artifact contract
- source-of-truth order
- failure-loudly rules
- handoff rules to other skills

It should not pretend to own:

- backlog triage
- bug fixing
- long-running parity remediation

The docs-site handoff is required for client-facing documentation. The bridge
script reuses the canonical promotion contract in the `alleato-os` repository;
that repository owns editorial review, docs navigation, deployment, and
production URL verification.

## Recommended Artifact Model

Every doc workflow should leave a stable artifact packet under
`docs/tutorials/<module>/<slug>/`.

Required:

- `manifest.json`
- `<slug>.md`
- `documentation-draft.md`
- `documentation-input.json`
- `source-brief.md`
- `session.webm`
- `screenshots/*.png`

For client-facing pages, the packet must also be promoted to the canonical
Alleato docs repository:

```bash
npm run tutorial:promote-docs-site -- \
  docs/tutorials/<module>/<slug>/manifest.json \
  --title "..." \
  --description "..." \
  --module <module> \
  --image-slug <slug> \
  --route "/[projectId]/..."
```

The command creates an MDX draft and copies only verified screenshots to
`alleato-os/apps/docs`. A client-facing tutorial is not `published` until the
docs repository sets it visible, passes its screenshot/navigation checks, and
the production page is reachable.

Recommended additions for audit mode:

- `audit-report.md`
- `parity-gaps.json`

Those audit artifacts are not yet a required runtime contract, but they are the
right extension point.

## Recommended Status Model

Use the existing `training_docs` row as the control-plane owner.

Short term:

- keep status in `training_docs.status`
- keep doc metadata and blockers in `training_docs.review_notes` or structured
  metadata

Recommended normalized states:

- `planned`
- `captured`
- `drafted`
- `review_needed`
- `published`
- `stale`
- `blocked`

Recommended metadata keys:

- `workflowKey`
- `sourceRoute`
- `procoreQuery`
- `lastCapturedAt`
- `lastAuditedAt`
- `lastParityStatus`
- `blockerType`
- `blockerOwner`
- `productGapIssueId`

If a dedicated docs-status dashboard is built later, it should read from these
fields instead of introducing a second tracker.

## How To Map The Full Docs Inventory

Use Procore as the inventory seed, not as the final author.

Recommended mapping process:

1. Start with Procore tool families and support categories.
2. Match each category to the real Alleato route and workflow.
3. Create one inventory record per user job, not per page component.
4. Mark each item:
   - no Alleato route yet
   - route exists, doc missing
   - doc exists, stale
   - doc published and current
5. For each item, store:
   - tool/category
   - user job
   - route
   - workflow file
   - Procore query
   - doc slug
   - current status

This inventory should eventually live in the admin training-docs surface, but
the same model can start as a generated markdown or JSON ledger.

## QA And Parity Integration

This system should intentionally double as QA intake.

When audit mode finds a mismatch, classify it:

- `doc-only drift`: the product works, the doc is stale
- `product parity gap`: the doc exposed a missing or different feature
- `capture failure`: auth, route, seed data, or workflow automation issue
- `source ambiguity`: Procore reference is unclear or low confidence

Then route it:

- `doc-only drift` -> `refresh`
- `product parity gap` -> engineering issue + verification task
- `capture failure` -> workflow/runtime fix
- `source ambiguity` -> Procore RAG plus manifest review

Do not let audits silently die inside markdown notes.

## AI Assistant Consumption Model

The assistant should not rely only on general RAG when exact workflow guidance
is required.

Preferred source order for AI tool help:

1. published Alleato training docs
2. structured doc metadata
3. ordered training doc steps
4. current route-specific form/schema/runtime truth
5. Procore reference material for supplemental context

This is the key distinction:

- Procore is for parity and inventory
- Alleato published docs are for end-user instruction
- structured step data is for task-aware agent assistance

If an assistant is helping a user create a prime contract or commitment, it
should read the normalized Alleato doc packet first, not a vague retrieval chunk.

## Failure-Loudly Rules

The pipeline must fail loudly when:

- capture lands on `/auth/login`
- capture lands on `/access-denied`
- the route does not match the intended workflow
- the support retrieval is empty or low confidence
- the generated draft still contains Procore branding or links
- a publish run updates a new slug instead of the intended existing slug
- an audit finds a product gap and no issue is recorded

Every failure should say:

- cause
- exact failed step
- owner
- next action

## Recommended Next Implementation Phases

### Phase 1: Control plane cleanup

- Add structured metadata/status fields to the training-doc workflow.
- Expose stale, blocked, and audit-needed states in the admin page.
- Add an inventory view grouped by tool and status.

### Phase 2: Audit mode artifacts

- Add `audit-report.md` and machine-readable parity findings.
- Wire findings to Linear issue creation for product gaps.
- Add stale-doc detection based on route or workflow changes.

### Phase 3: AI assistant consumption

- Make AI help tools prefer published training docs and step records.
- Attach field-level guidance and related-doc relationships.
- Add route-aware retrieval so the assistant can answer with the exact current
  workflow.

## Decision Summary

The simplest durable system is:

1. Keep one canonical docs pipeline.
2. Use Procore only as reference and parity seed.
3. Treat Playwright capture as the proof layer.
4. Publish normalized Alleato docs into `training_docs`.
5. Use the same system for create, refresh, and audit.
6. Feed AI tools from published Alleato docs plus structured steps, not only
   broad source retrieval.
