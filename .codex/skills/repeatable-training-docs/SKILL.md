---
name: repeatable-training-docs
description: >
  Capture an Alleato workflow step by step, save a walkthrough video plus per-step
  screenshots, and generate an Alleato-only markdown documentation draft from the
  stored support-article corpus. Use when the goal is a repeatable SOP or help
  article for any in-app workflow.
argument-hint: "<workflow file or feature name>"
---

# Repeatable Training Docs

Use this skill when you need documentation for a real Alleato workflow and you
want the same process every time:

1. Record the workflow in the app.
2. Save one session video and one screenshot per step.
3. Pull source context from the stored support-article corpus.
4. Generate an Alleato-only draft with no external-brand mentions and no
   external documentation links.
5. Publish the training record, promote the public docs article, and verify its deployed route.

## Inputs You Need

- A workflow definition under `scripts/tutorials/workflows/*.workflow.ts`
  or a new one you create for the target feature.
- An authenticated Playwright storage state for the same base URL.
- A precise source route or user journey inside Alleato.
- A query string that describes the workflow for support-article retrieval.

## Output Contract

Every run must leave these artifacts in the chosen output directory:

- `manifest.json`
- `<slug>.md`
- the walkthrough video file (`.webm`)
- `screenshots/*.png`
- `source-brief.md`
- `documentation-draft.md`
- `documentation-input.json`

If any of these are missing, the run is incomplete.

## Non-Negotiable Completion Gates

This is one pipeline: **preflight → capture → compose → validate → publish →
promote → deploy → live verification**. Do not stop after any intermediate
stage, and do not call a run complete because a command exited zero.

- Capture only after verifying the authenticated storage state, target route,
  required form controls, and seeded record or data prerequisites.
- Stateful workflows must use required field/value read-backs and required
  summary assertions before screenshots that represent entered values or final
  totals. Optional locator failures are not allowed for documented fields.
- Public-doc captures must use `--docs-screenshots`.
- A capture packet is valid only when its manifest routes are not login or
  access-denied pages, every step screenshot exists, and `ffprobe` reports a
  walkthrough-video duration greater than zero.
- Publishing is valid only after `training_docs` read-back confirms the
  published record, ordered steps, ordered screenshots, and one video asset.
- Docs-site promotion is valid only after navigation is generated, screenshot
  validation passes, Mintlify deploys successfully, and the exact live route
  renders with its video and walkthrough link.

## Hard Rules

- Final documentation must never mention `Procore`.
- Final documentation must never link to external support articles.
- Remove source-only steps, permissions, statuses, or UI that do not exist in
  Alleato.
- Treat the captured Alleato workflow as the source of truth for step order.
- Fail loudly on login redirects, access denied pages, wrong routes, empty
  support matches, or forbidden source leakage.

## Workflow

### 1. Capture the Alleato workflow

Run the recorder:

```bash
npm run tutorial:capture -- scripts/tutorials/workflows/<workflow>.workflow.ts \
  --base-url http://localhost:3001 \
  --storage-state frontend/tests/.auth/user.json \
  --docs-screenshots \
  --output-dir docs/tutorials/<module>/<slug>
```

The capture is not valid unless:

- `manifest.json` exists
- the walkthrough video file exists
- each documented step has a screenshot
- no step source URL points to `/auth/login` or `/access-denied`
- required field and summary assertions prove the screenshot state
- `ffprobe` reports a duration greater than zero for `session.webm`

### 2. Generate the doc draft from stored source material

Run the composer:

```bash
node scripts/tutorials/compose-training-doc.mjs \
  docs/tutorials/<module>/<slug>/manifest.json \
  --query "<workflow query>" \
  --title "<final document title>"
```

Optional:

- `--output-dir <dir>` to write drafts elsewhere
- `--doc-type tutorial|how-to`
- `--audience internal|client|subcontractor|admin`
- `--top-k 8` to widen support retrieval
- `--no-ai` to use the deterministic fallback

### 3. Review the generated draft

Check `documentation-draft.md` against this list:

- Does it only describe Alleato behavior?
- Are the steps in the same order as `manifest.json`?
- Are external-brand mentions absent?
- Are external support links absent?
- Did the draft drop source-only content that does not appear in Alleato?

If not, fix the workflow or regenerate. Do not hand-edit around a broken source
contract without noting the cause.

### 4. Publish back into training docs when needed

```bash
npx tsx scripts/tutorials/publish-tutorial.ts \
  docs/tutorials/<module>/<slug>/manifest.json \
  --app-tool-category <Category> \
  --source-route <route> \
  --title "<final document title>"
```

This should register:

- ordered step screenshots
- ordered step records
- one walkthrough video asset

Immediately read back the returned record. It must be `published` with the
expected app URL, ordered step count, screenshot count, and exactly one video.

### 5. Validate the complete packet

Run the shared validator after composition and before either publish target:

```bash
npm run tutorial:validate-packet -- \
  docs/tutorials/<module>/<slug>/manifest.json \
  --require-docs-screenshots
```

It rejects missing artifacts, missing screenshots, blocked source routes,
unfinalized videos, and full-app screenshots. Fix the stated boundary and
rerun from that stage; do not bypass the check.

### 6. Promote and deploy the docs-site article

```bash
node scripts/tutorials/promote-to-alleato-docs-site.mjs \
  docs/tutorials/<module>/<slug>/manifest.json \
  --title "<final document title>" \
  --description "<reader-facing summary>" \
  --module <module> \
  --image-slug <slug> \
  --route "/[projectId]/<route>"
```

In the canonical `alleato-os` repository, complete the editorial pass, add the
page to `apps/docs/navigation.config.mjs`, then run:

```bash
node apps/docs/scripts/build-nav.mjs
node apps/docs/scripts/build-nav.mjs --check
node apps/docs/scripts/check-doc-screenshots.mjs
```

Commit and push the docs-site files, wait for the Mintlify deployment check,
then open the exact public URL. Verify the page title, sidebar entry, step
screenshots, interactive walkthrough link, and a video element with a non-zero
duration. Always return that live URL.

### 7. Audit and close the run

Run the existing audit/writeback stage after publishing:

```bash
npx tsx scripts/tutorials/audit-training-doc.ts \
  docs/tutorials/<module>/<slug>/manifest.json
```

Record the capture output, validator output, in-app publish read-back,
docs-site commit, Mintlify deployment, and live screenshot in the task or
handoff. A failed stage must record its first failing boundary, exact command,
artifact path, recovery action, and owner.

### 8. Use this template for the final doc shape

Start from:

`/.codex/skills/repeatable-training-docs/templates/training-doc-template.md`

## Failure-Loudly Checklist

- Missing auth state: refresh the storage-state file and rerun.
- Missing form controls or seed data in preflight: repair the route, membership,
  or fixture before recording; never capture a shell, 404, or empty state.
- Final screenshot does not show the documented values: add required field and
  summary read-backs to the workflow, then recapture.
- Wrong page captured: add or tighten route assertions in the workflow.
- Empty support retrieval: rephrase the query with the tool and action name.
- Forbidden source leakage in the draft: fix the composer input or sanitizer,
  then rerun; do not publish the contaminated draft.
- Video missing, zero-duration, or not playable: treat capture as failed and
  repair recorder finalization before publishing any asset.
- In-app publication succeeds but docs-site publication is absent: complete
  navigation generation, deployment, and exact-route browser verification; do
  not hand the user an in-app link as a substitute for the public docs URL.
