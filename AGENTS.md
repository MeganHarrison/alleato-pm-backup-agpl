# AGENTS

You are Codex running inside the Codex CLI on the user's Mac.

## Proactive Systems Thinking Rules

Rule 1: Never create one-off components, one-off styling, page-local hard-coded UI, or page-level visual overrides when an existing shared primitive, pattern, or design-system component can reasonably be used. If a one-off implementation or local override is explicitly requested and absolutely mandatory, document why in the code, explain why no shared primitive fits, and create or reference a follow-up to move it into a shared abstraction when appropriate.
Rule 1A: Apply the path-of-least-resistance reuse gate before writing UI. First locate the canonical route, page component, table definition, tab primitive, form pattern, or data hook for the requested behavior. Reuse that owner directly and change only the query, scope, or adapter data. Do not recreate a component or copy its JSX/config. A hand-rolled replacement is invalid unless the canonical owner has been inspected, reuse has been attempted, and the exact incompatibility is documented in the task and code. The default question before editing is: "What existing implementation already does this?"
Rule 2: Do not ship silent failures.
Rule 3: Do not return generic errors.
Rule 4: Do not fix a recurring bug without adding a guardrail.
Rule 5: Do not introduce one-off handling when a shared abstraction is warranted.
Rule 6: For every failure, explain cause, detection gap, and prevention step.
Rule 7: Before closing any task, ask: “How does this fail loudly?”
Rule 8: Before closing any bug, ask: “What makes this never happen again?”
Rule 9: Never ship band-aid fixes. If a change only satisfies the immediate error without addressing the underlying design, contract, ownership boundary, or guardrail gap, stop and replace it with a durable fix. Temporary mitigations are allowed only when explicitly labeled as temporary, paired with a tracked follow-up, and justified because the durable fix is blocked.
Rule 10: No fixes without localization. When debugging any bug, regression, failing test, or unexpected behavior: observe the running system first (browser/console/DOM/DB evidence — never source-rereading alone), walk the layer boundaries (DB → API → client state → DOM), and identify the first boundary where expected ≠ observed before editing any product code. After two failed hypotheses, stop and test your assumptions instead of forming a third; remove speculative edits before applying the confirmed fix. Read `.claude/rules/DEBUGGING-GATE.md` before starting any debugging work — it is the mandatory debugging process for this repo.

## Delivery Lanes and Evidence

Choose the lowest lane that matches the actual risk. Do not accumulate the
requirements of every lane. If uncertain, choose the higher lane.

| Lane | Use when | Required closeout |
| --- | --- | --- |
| Fast | Small, isolated copy, docs, test, type, styling, or helper edit; no schema, auth, money, provider, deployment, or cross-workflow behavior | One targeted check. For a requested visual change, one current route screenshot. No task file, Linear issue, handoff, manifest, or independent reviewer. |
| Standard | A bounded feature or bug slice with one runtime boundary | Task file with `Delivery lane: Standard`; targeted test(s) plus one proof at the changed boundary (browser, API, database, or job). No full suite, mandatory Linear, handoff, or independent reviewer. |
| High-risk | Schema/migration, auth/permissions, money, provider/deployment, AI/RAG, external delivery, destructive operation, or cross-workflow change | Task, explicit acceptance contract, focused regression tests, end-to-end proof, independent review, and release evidence. Linear/handoff are required only if the work is tracked or has more than one session. |

The task file is required only for Standard and High-risk work. Use
`docs/ops/tasks/TASK-TEMPLATE.md`. A task cannot be described as complete while
its required checklist remains open; Fast work reports its changed files and
targeted check directly.

Evidence must prove the changed boundary, not unrelated layers. A CSS change
does not require database readback; an API-only change does not require visual
screenshots. Desktop and mobile proof are required only when the requested UI
is responsive or its layout changes. Store evidence with the task; attaching it
to Linear/GitHub is High-risk-only or when the user asks for external review.

## General

- When searching for text or files, prefer `rg` or `rg --files` (faster than `grep`).
- If a tool exists for an action, use the tool instead of shell commands (`read_file` over `cat`). Default solver tools: `git`, `rg`, `read_file`, `list_dir`, `glob_file_search`, `apply_patch`, `todo_write/update_plan`. Use `cmd`/`run_terminal_cmd` only when no listed tool can perform the action.
- Parallelize tool calls whenever possible (`multi_tool_use.parallel`). Never read files one-by-one unless logically unavoidable.
- Code chunks may include inline line numbers like `Lxxx:LINE_CONTENT`. Treat the `Lxxx:` prefix as metadata — do NOT include it in edits.
- Default expectation: deliver working code, not just a plan. If details are missing, make reasonable assumptions and complete a working version.
- Do not tell the user to perform actions that the agent can execute directly (e.g., migrations, type generation, lint/type checks, or local commands). Execute them and report the result.

## External Service Ownership (MANDATORY)

## Documentation Site Ownership (MANDATORY)

Public Alleato documentation is owned and deployed from the separate repository
[`The-Alleato-Group/alleato-docs-site`](https://github.com/The-Alleato-Group/alleato-docs-site),
not this `project-management` repository. When a task changes customer-facing
docs content, navigation, screenshots, or docs-site configuration:

1. Make the change in `alleato-docs-site`, under `apps/docs/`, and merge/push it
   to that repository's `main` branch.
2. Do not treat a commit to this repository's `docs/` directory as a public-docs
   deployment; it is project and operational documentation only.
3. The live path is `alleato-docs-site/main` -> Mintlify hosting -> Vercel
   project `the-alleato-group/alleato-os-docs` -> `docs.alleatogroup.com`.
   Vercel is a proxy, not the content host.
4. Verify both the Vercel production deployment commit and the rendered copy at
   `https://docs.alleatogroup.com`. A Ready Vercel deployment alone does not
   prove that Mintlify received the docs change.
5. After a repository transfer or GitHub App permission change, confirm Mintlify
   is connected to `The-Alleato-Group/alleato-docs-site`, branch `main`, with
   monorepo path `apps/docs`; otherwise fail loudly and report the missing
   Mintlify authorization or connection.

## External Service Ownership (MANDATORY)

Do not ask or wait for the user to update environment variables, deployment
settings, migration state, provider keys, or service configuration when Codex can
do it through an available CLI, API, MCP connector, or configured credential.
Execute the provider operation directly, then verify it with a read-back command,
deployment log, migration ledger, or service status check.

This explicitly includes:

- Vercel environment variables, project settings, builds, and deployments
- Sentry DSNs, org/project/token-backed source-map configuration, and test events
- PostHog keys and capture/replay configuration
- Supabase migrations, type generation, SQL verification, and migration ledger checks
- Render services, env vars, deploy hooks, logs, and backend health checks
- GitHub, Linear, Teams, Microsoft, and other configured integration surfaces

Only mark the task blocked when the relevant CLI/API/MCP tool is unavailable,
auth/permissions fail, or the secret value cannot be discovered from an existing
secure source. In that case, report the exact missing capability or credential,
the command/tool that proved the block, and the smallest next setup action.
Never print secret values in logs, docs, commits, or final responses.

## Main Branch Finish Flow (MANDATORY)

Default to completing finished Codex tasks directly on `main` and publishing them to `origin/main`; do not create branches or worktrees for routine completion.

When a task is ready to close:

```bash
npm run codex:finish -- --message "Short imperative commit message" --files <task-owned paths>
```

Rules:

- Use `--files` with the exact task-owned files whenever the checkout has unrelated dirt.
- Use `--staged-only` only when exact hunk-level staging is needed because a task-owned file also contains unrelated existing edits.
- Use `--all-dirty` only when the current task owns every dirty file in the checkout.
- The command stages exact files, runs targeted checks, commits, and publishes exact files to `origin/main` without rebasing or stashing other sessions' work. In an isolated workspace it records a compact publication receipt; the canonical sweep retires it later.
- If the command blocks, treat that as a real failure: report cause, detection gap, prevention step, exact failing command, owner file(s), and whether it is related to the current task or unrelated repo debt.
- For state-only checks, use `npm run codex:finish -- --check`.
- Do not claim work is pushed until `codex:finish` or an equivalent explicit `git push origin main` plus `HEAD == origin/main` verification succeeds.

### Commit-closure invariant (mandatory)

Every task has exactly one normal terminal state: its task-owned changes are committed and published. A task is not done, paused, or ready for the next task while it leaves a dirty working tree, a local-only commit, an unpushed branch, or an unregistered worktree.

- Before starting a task, the canonical checkout must be wholly clean and have no active writer lease.
- Before starting another task, run `npm run codex:finish -- --message "..." --files <task-owned paths>` and verify `HEAD == origin/main`.
- Do not use `git stash` as normal task closure. A stash is recovery-only after an incident and must be named, attributed to a task, and treated as blocked until it is published or explicitly retired.
- If work cannot be published, record an explicit blocked handoff with owner, reason, exact paths, and next action; do not begin unrelated work in that checkout.
- Concurrent writers must use registered isolated workspaces. The canonical checkout permits one writer, one task, and one clean closeout at a time.

## Parallel Session Orchestration

### Canonical Checkout Writer Lease (MANDATORY)

Concurrent sessions may research, review, inspect, and run verification in
parallel. They must not concurrently make product edits in the same checkout.
Concurrent product mutations use an isolated workspace with exact path
ownership; the canonical checkout is read/integration-only while concurrent
writers exist. A single-session Fast change may edit the canonical checkout
directly when its exact files are clean and unclaimed. Do not create a board
row, handoff, Linear sub-issue, or worktree for that case.

Resource budget: default to at most three active agent sessions on one machine,
including the leader. Do not maximize agent count mechanically. Browser, MCP,
build, and dev-server processes are machine-wide resources; only the session
that owns that boundary may start them. Before adding another agent, confirm
that the existing work cannot proceed independently in the current session.
Run `npm run ops:process-budget` before adding a session or starting an
expensive verifier. If it fails, reuse or retire existing processes first.

Register the intended clean `main` checkout once:

```bash
node scripts/ops/checkout-session-gate.mjs bootstrap
```

Before a concurrent session writes code, create an isolated workspace:

```bash
node scripts/ops/isolated-session-workspace.mjs create \
  --session S<id> --task <Linear-or-local-task-id> --paths <owned-paths> --expires-hours 4
```

Do not bypass path ownership with a branch switch, stash, reset, or a second
workspace: preserve and attribute the existing diff. `codex:finish` records
publication; only a canonical sweep removes a published workspace:

```bash
node scripts/ops/isolated-session-workspace.mjs sweep --retire-published yes
```

Use `status` before taking over stopped work. Expired workspaces are preserved,
not deleted. This removes shared mutable state while keeping analysis and
verification parallel.

Use `docs/ops/orchestration/` only for High-risk work or concurrent work with
overlapping ownership, external coordination, or a review handoff.

### Required Files

- `docs/ops/orchestration/leader-runbook.md`
- `docs/ops/orchestration/worker-protocol.md`
- `docs/ops/orchestration/session-board.md`
- `docs/ops/orchestration/review-queue.md`
- Worker handoffs: `docs/ops/handoffs/YYYY-MM-DD-S<session>-<topic>.md`

### Non-Negotiable Rules

1. Every concurrent writer claims exact paths before coding.
2. High-risk and multi-session work maintains a handoff; Fast and Standard work do not.
3. Unclaimed concurrent work is invalid and must not be treated as progress.
4. Evidence is proportional to its delivery lane; missing High-risk evidence is `Needs Rework`.

### Leader Responsibilities

- Assign non-overlapping ownership scopes.
- Process `Pending Review` items every 30-60 minutes.
- Accept/reject with explicit notes in `review-queue.md`.
- Reflect accepted outcomes in `docs/ops/logs/` and `docs/ops/memory/current-state.md`.

### Worker Summary Requirement

Yes: each active session must summarize what it did and what it found in its handoff file so the leader can consolidate and decide.

## Long-Running Verification

Do not block the main conversation on long-running verification unless the user explicitly asks to wait.

Never run a full focus suite, build, typecheck, crawl, or predeploy gate by
default after every file or ordinary issue slice. Run it once for a High-risk
release candidate, CI/nightly regression, or when a targeted failure indicates
the changed boundary is broader than expected.

When an expensive check is justified:

1. Run at most one build, typecheck, crawl, or browser-verification process for
   this repository on the machine at a time. Reuse its result for the fixed
   commit instead of rebuilding in another session.
2. Use a verification sub-agent only when implementation can continue in
   parallel and the machine resource budget permits it. A verifier must not
   launch unrelated MCP servers, browsers, or dev servers.
3. Keep the main thread focused on implementation, short targeted checks, integration decisions, and fixing concrete blockers.
4. Do not stream large lint, build, crawl, or test logs into the main conversation.
5. Use the smallest check that can falsify the change first. Run full or
   project-wide checks once at a release checkpoint, not once per agent or file.
6. A verification sub-agent must return a compact report with:
   - pass/fail status
   - exact failing command
   - concise error lines only
   - likely owner file(s)
   - whether the failure is related to the current task or unrelated repo debt
7. The main agent should re-engage only when the sub-agent reports a concrete blocker that needs code changes or when final pass/fail status is needed for the user.

Default pattern:

- Main thread: implementation, short checks, decisions.
- Current session or one connector-light verifier: the single justified
  typecheck, build, predeploy, full test suite, or long-running verification.
- Final answer: summarize what changed, what passed, what remains, and recommended next steps.

## Linear and Handoffs

Use Linear when the user asks for tracking, work is High-risk, or multiple
sessions need a shared owner. Use one kickoff and one closeout comment; add a
comment only for a material blocker, scope change, or handoff. Do not create
Linear sub-issues, handoffs, or board rows merely because a Standard task has
several files. Process reference: `docs/ops/orchestration/linear-codex-process.md`.

---

## Frontend-First Validation Workflow (MANDATORY FOR "MAKE IT WORK")

When the objective is the complete construction-management workflow below,
prioritize these end-user flows over backend-only activity. Do not impose this
entire chain on an isolated page, styling, copy, helper, or route change.

### Canonical User Journey Test Chain

1. Create Project
2. Add Budget
3. Create Prime Contract + Schedule of Values
4. Create Commitments (including subcontractor SOV where applicable)
5. Execute Change Management flow:
   - Change Event
   - Potential Change Order
   - Official Change Order
6. Create/validate Invoicing flow

### Execution Rules

- Test this chain as user flows first (agent-browser/manual-style E2E), then add/refresh Playwright coverage for deterministic regression checks.
- For each step, log pass/fail, blocker, and artifact path (screenshot/video/report) in worker handoff.
- Any backend change without corresponding frontend flow verification is incomplete.
- Focus work queue by user-visible breakage severity, not by subsystem ownership.

### Definition Of Practical Progress

Progress only counts when a user-flow step is verified passing with artifacts and accepted in the review queue.

---

## BMAD Method Integration

This project uses **BMAD Method v6** (`_bmad/`). When the user invokes a BMAD agent or workflow, load and follow the corresponding file.

### Invoking Agents

Read the agent file and adopt its persona, principles, and menu for the conversation:

| User request                          | File to read                                  |
| ------------------------------------- | --------------------------------------------- |
| "act as dev" / "bmad dev"             | `_bmad/bmm/agents/dev.md`                     |
| "act as pm" / "bmad pm"               | `_bmad/bmm/agents/pm.md`                      |
| "act as architect" / "bmad architect" | `_bmad/bmm/agents/architect.md`               |
| "act as analyst" / "bmad analyst"     | `_bmad/bmm/agents/analyst.md`                 |
| "act as sm" / "bmad sm"               | `_bmad/bmm/agents/sm.md`                      |
| "act as qa" / "bmad qa"               | `_bmad/bmm/agents/qa.md`                      |
| "act as ux" / "bmad ux"               | `_bmad/bmm/agents/ux-designer.md`             |
| "act as tech-writer"                  | `_bmad/bmm/agents/tech-writer/tech-writer.md` |
| "act as quick-dev" / "barry"          | `_bmad/bmm/agents/quick-flow-solo-dev.md`     |
| "act as tea" / "murat"                | `_bmad/tea/agents/tea.md`                     |
| "act as bmad-master"                  | `_bmad/core/agents/bmad-master.md`            |

### Invoking Workflows

Read the workflow file and execute its steps:

| User request                      | File to read                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| "create prd"                      | `_bmad/bmm/workflows/2-plan-workflows/create-prd/workflow-create-prd.md` |
| "create architecture"             | `_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.md`      |
| "create epics and stories"        | `_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md` |
| "create story [id]"               | `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`        |
| "dev this story [file]"           | `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`           |
| "sprint planning"                 | `_bmad/bmm/workflows/4-implementation/sprint-planning/workflow.yaml`     |
| "sprint status"                   | `_bmad/bmm/workflows/4-implementation/sprint-status/workflow.yaml`       |
| "code review"                     | `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`         |
| "quick spec"                      | `_bmad/bmm/workflows/bmad-quick-flow/quick-spec/workflow.md`             |
| "quick dev [spec]"                | `_bmad/bmm/workflows/bmad-quick-flow/quick-dev/workflow.md`              |
| "document project"                | `_bmad/bmm/workflows/document-project/workflow.yaml`                     |
| "generate project context"        | `_bmad/bmm/workflows/generate-project-context/workflow.md`               |
| "qa generate e2e tests [feature]" | `_bmad/bmm/workflows/qa-generate-e2e-tests/workflow.yaml`                |
| "setup test framework"            | `_bmad/tea/workflows/testarch/framework/workflow.yaml`                   |
| "write acceptance tests"          | `_bmad/tea/workflows/testarch/atdd/workflow.yaml`                        |
| "expand test coverage"            | `_bmad/tea/workflows/testarch/automate/workflow.yaml`                    |
| "review tests"                    | `_bmad/tea/workflows/testarch/test-review/workflow.yaml`                 |
| "brainstorm"                      | `_bmad/core/workflows/brainstorming/workflow.md`                         |

Full agent + workflow list: `_bmad/_config/agent-manifest.csv`, `_bmad/_config/workflow-manifest.csv`.

### BMAD Rules

- Load resources at runtime — never pre-load or summarize agent files; read and execute them.
- When adopting an agent persona, follow its principles and present its menu.
- Agent customizations for this project live in `_bmad/_config/agents/`.

---

## Browser Automation

Use the Codex in-app browser for interactive verification when it is available.
Reuse one authenticated browser session and one local frontend server.
`agent-browser` is the fallback for environments without the in-app browser.

**Default policy (mandatory):**

- For frontend user-journey and manual-style E2E verification, use the existing
  Codex in-app browser first; do not launch a second Chrome/profile/session.
- Use `agent-browser` only as a fallback and always reuse a named persistent session.
- Use one Playwright code-based suite only when deterministic CI coverage or
  deep crawl/extraction is required. Do not start a Playwright MCP server per agent.
- Never claim "verified" without evidence artifacts (screenshots, video, markdown summary).

Fallback `agent-browser` workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes

## Project Overview

**Alleato-Procore** — construction project management platform (Next.js 15 frontend + Supabase backend). Mirrors Procore functionality: budgets, contracts, change orders, directory, scheduling, and more.

### Hosting Source Of Truth

- **Frontend production host:** Vercel.
- **Backend production host:** Render, configured by root `render.yaml` (single canonical file; not blueprint-linked — live config is managed via Render API).
- **Backend service:** Render service `alleato-backend`.
- **Do not use Railway for this repo.** Railway config, commands, and assumptions are stale/outdated for Alleato PM backend work.
- **Do not debug or patch deployment issues against unused hosts.** For backend runtime, health, env vars, logs, and pipeline behavior, inspect Render/FastAPI first.
- **Required backend AI env:** `AI_GATEWAY_API_KEY` must be configured on Render and is the primary provider path for ingestion/vectorization. Direct `OPENAI_API_KEY` is fallback only and currently may be quota-limited.
- **Pipeline source of truth:** `frontend/src/lib/rag-pipeline/process-document-workflow.ts` is the sole durable ordering/retry owner. Vercel Workflow calls authenticated, single-stage FastAPI adapters under `/api/pipeline/stages/{stage}`. `/api/pipeline/process` is compatibility ingress only; it must never start in-process orchestration.
- **Drawing OCR source of truth:** Azure Document Intelligence is live on Render. Drawing uploads create `document_metadata` rows with `status='no_text'`, `source_system='drawing_upload'`, and text is written to `document_metadata.content` (not `raw_text`) by `backend/src/services/integrations/microsoft_graph/ocr_worker.py`. Reference `docs/architecture/OCR-PIPELINE.md` before changing drawing upload, OCR, or RAG embedding behavior.
- **Render env var safety:** Never use Render API `PUT /env-vars`; it replaces the entire environment set. Use individual create/update env-var operations and verify by reading service env/deploy status back.

### Directory Structure

```text
alleato-procore/
├── frontend/                 # Next.js 15 App Router application
│   ├── src/
│   │   ├── app/             # App Router pages and API routes
│   │   │   ├── (main)/      # Project-scoped pages (with sidebar)
│   │   │   ├── (tables)/    # Table view pages
│   │   │   ├── api/         # API route handlers
│   │   │   └── auth/        # Auth pages
│   │   ├── components/      # React components
│   │   │   ├── ui/          # shadcn/ui primitives
│   │   │   ├── domain/      # Domain-specific components
│   │   │   └── layout/      # Layout components
│   │   ├── hooks/           # React Query hooks (use-*.ts)
│   │   ├── lib/
│   │   │   ├── supabase/    # Supabase client setup
│   │   │   └── schemas/     # Zod validation schemas
│   │   ├── services/        # Business logic services
│   │   └── types/           # TypeScript types (database.types.ts)
│   ├── tests/               # Playwright E2E tests
│   └── config/playwright/   # Playwright config
├── backend/                  # Python FastAPI backend
├── supabase/
│   └── migrations/          # SQL migrations
├── _bmad/                   # BMAD Method v6 agents and workflows
└── scripts/                 # Utility scripts
```

---

## Critical Project Rules (Non-Negotiable)

### 1. Supabase Types Gate

**BEFORE writing ANY database code:**

```bash
npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public \
  > frontend/src/types/database.types.ts
```

Then read `frontend/src/types/database.types.ts` — verify tables/columns exist. FK column type **must** match the PK type (e.g., `projects.id` is INTEGER, not UUID — a common source of silent failures).

### 1A. Supabase Migration Application Gate

Writing a migration is not a completed database fix. If a task creates or changes any file under `supabase/migrations/*.sql`, Codex owns applying it or explicitly recording why it is intentionally deferred.

Required closeout:

```bash
npm run db:migrations:verify-applied -- supabase/migrations/<timestamp>_<name>.sql
```

Completion rules:

- Do not claim a database-backed fix is done while its migration is only present locally.
- Verify the linked Supabase remote ledger shows the migration version in both Local and Remote columns.
- Record the migration ledger evidence in the handoff `Migration ledger evidence` field.
- If `supabase db push` would apply unrelated pending migrations, apply the task migration deliberately and then repair/check the exact migration version.
- If applying a migration is intentionally deferred, the final answer and handoff must say `Blocked/Deferred`, include the exact migration file, cause, detection gap, prevention step, and next owner action.

### 1B. Drawing OCR Pipeline Gate

Drawing uploads and drawing RAG search depend on the OCR pipeline documented in
`docs/architecture/OCR-PIPELINE.md`.

Rules:

- New drawing uploads must create a `document_metadata` row with `status='no_text'`, `source_system='drawing_upload'`, `document_type='drawing'`, and a Supabase Storage `source_web_url`.
- OCR text is stored in `document_metadata.content`, not `raw_text`.
- `ocr_partial` is searchable and embedded; it means the Azure page cap was hit.
- `ocr_failed` is not retried automatically. To retry, reset only scoped drawing-upload rows back to `no_text`, then run the admin OCR backfill endpoint.
- Drawing PDFs uploaded through the app live in Supabase Storage, not OneDrive. OCR download logic must keep the Supabase public URL path separate from Microsoft Graph download paths.
- Azure OCR env vars (`AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`, `AZURE_DOCUMENT_INTELLIGENCE_KEY`, `AZURE_OCR_PAGE_CAP`, `AZURE_OCR_BATCH_SIZE`) live on Render `alleato-backend`. Never print secret values.

### 2. Route Naming Gate

Always use specific parameter names. **Never** use generic `[id]` — causes Next.js routing conflicts that crash the dev server.

| Resource       | Correct param  |
| -------------- | -------------- |
| Project        | `[projectId]`  |
| Contract       | `[contractId]` |
| Company        | `[companyId]`  |
| User           | `[userId]`     |
| Record (admin) | `[recordId]`   |

Run `npm run check:routes` after creating dynamic routes.

### 3. Next.js Cache Gate

Before debugging ANY 404 or routing issue on new/modified files:

```bash
cd frontend && rm -rf .next && pkill -f "next dev"
npm run dev > /tmp/nextjs-dev.log 2>&1 &
sleep 10 && tail -20 /tmp/nextjs-dev.log  # verify "Ready"
```

Never debug code before clearing `.next` cache.

### 4. Root Cause Gate

Before modifying code to fix an issue:

1. Gather runtime evidence (actual errors, query results, console output)
2. State root cause as a fact with evidence
3. Only then make targeted fixes — never modify based on grep searches alone

### 5. Page Header Pattern

All project pages must use this pattern:

```tsx
import { PageContainer, ProjectPageHeader } from "@/components/layout";

<>
  <ProjectPageHeader title="..." description="..." actions={<div>...</div>} />
  <PageContainer>{/* content */}</PageContainer>
</>;
```

Never use deprecated `ProjectToolPage` or `PageHeader` from `@/components/design-system`.

### 6. Fix First, Report Later

When encountering a bug: **fix it immediately, then report what you fixed.** Do not ask permission for obvious fixes (page crashes, empty dropdowns, 500 errors, broken queries). Only ask first for destructive operations or architectural decisions with multiple valid approaches.

### 7. Premium Minimal UI Baseline (MANDATORY)

When asked to design/build a page, default to **Linear/Supabase-style minimal UI**.

### 7A. Always-On Alleato Product Noise Gate (MANDATORY)

For any user-facing frontend page, feature, component, form, table, AI surface,
dashboard, executive brief, project intelligence view, or visual polish task,
treat Impeccable's Alleato product noise gate as active even when the user does
not mention Impeccable.

Canonical reference: `.agents/skills/impeccable/reference/alleato-product-noise-gate.md`
Direct command: `impeccable noise-gate [target]`

Required behavior:

- Before adding UI, identify the primary user, primary job, primary decision,
  Tier 1 content, content hidden until requested, removal candidates, primary
  action, and failure-loudly behavior.
- The burden of proof is on addition. Any new visual element must improve
  comprehension, decision quality, task speed, error prevention, source
  confidence, or recovery.
- Remove before restyling. Do not make noisy elements prettier until they prove
  they deserve to exist.
- Do not ship nested cards, wrapper panels, decorative badges/icons, helper
  widgets, duplicate CTAs, decorative dashboards, or visual filler.
- Final frontend responses must include noise gate pass/fail, what was removed
  or simplified, remaining risk, and regression guardrail.

**Hard constraints:**

- No nested cards (`Card` inside `Card` is forbidden)
- No decorative wrapper cards around whole sections
- No bordered or boxed page-level wrappers around the main content area
- Borders are not hierarchy. Start with whitespace, typography scale, muted text, icons, indentation, row dividers, and tonal elevation before adding any border.
- Do not frame page content with `border`, `rounded-*`, or `bg-*` shells unless the element is a true localized component (table shell, input, modal, attachment module, etc.)
- No full-page borders around experimental tools, onboarding pages, avatar pages, or AI pages
- General app pages must use the normal app shell and `PageShell`; do not place non-chat pages under the full-bleed chat route group
- Do not duplicate the same primary CTA in both the page header and page body
- Max 2 visual container levels: page shell + section content
- No stat cards, stats-card rows, KPI-card rows, metric tiles, count summary cards, or top-of-page numeric summary cards. This is a hard product rule: do not use prime page real estate for aggregate counts unless the user explicitly asks for a monitoring dashboard and the cards are the primary workflow.
- No heavy shadows (`shadow-lg`, `shadow-xl`, glow effects)
- No mixed accent palette (pick one accent and stay consistent)
- No emojis in production UI copy, states, labels, or empty-state visuals unless explicitly requested by the user
- No unsolicited helper panels, finder widgets, explanatory blocks, banners, callouts, or "nice to have" modules on production pages. Every visible element must answer a user need already proven by the workflow. If it does not make the primary task faster, clearer, or safer, remove it.
- No visual noise as a placeholder for product thinking. Do not add secondary search boxes, ownership finders, summary strips, empty helper text, badges, icons, or extra sections just because data exists. Earn the space with a concrete workflow requirement, or keep the page quiet.

**Default page structure:**

```tsx
<>
  <ProjectPageHeader title="..." description="..." actions={<div>...</div>} />
  <PageContainer className="space-y-8">
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Section title</h2>
      </div>
      {/* Content: table, form grid, or list */}
    </section>
  </PageContainer>
</>
```

**Use cards only when semantically necessary:**

- Distinct records in mobile list view
- Isolated modules like activity feed or attachments

**Important clarification:**

- `PageContainer` is a spacing/layout wrapper, not a visual frame
- Default page sections should be open on the canvas, not enclosed in bordered boxes
- If a section is primarily text, chat, lists, or general page content, prefer whitespace, alignment, and dividers over borders
- Borders are for controls and bounded subcomponents, not for wrapping the page itself
- For accordion, activity, navigation, and side-list patterns, use icon weight, text hierarchy, row spacing, hover tint, and `divide-y` rows instead of wrapping every row or group in a bordered card
- For chat history, navigation, and side lists: use plain list rows, not tiles, pills, or boxed cards
- Prefer the quietest control that works: icon actions over labeled toolbars when the action is obvious
- Page-level additions must pass the signal test before implementation: who uses it, when they use it, what decision it improves, and why the existing table toolbar/filter/search/detail flow cannot own it. If those answers are not clear, do not add the UI.

**Spacing/typography baseline:**

- 8px spacing rhythm (`space-y-2/4/6/8`, `gap-4/6`)
- Section spacing: `space-y-8`; group spacing: `space-y-4`
- Heading weights capped at semibold (`font-semibold`)

**Data-heavy UX principle:**

- Simplify complexity into insight
- Prioritize fast findability and low-friction scanning
- Use navigation aids (search, breadcrumbs, back actions) as support, not a crutch for unclear information architecture

### 8. Line Items Table Parity (MANDATORY)

For any form that includes editable line items (SOV, cost lines, invoice lines, etc.), the line-items UI must follow the same visual shell and spacing pattern as the Direct Costs form line-items component.

Canonical reference:

- `frontend/src/components/direct-costs/LineItemsManager.tsx`

Required parity points:

- Same table container treatment (subtle bordered shell + muted header row)
- Same compact header typography and row density
- Same totals-row treatment and right-aligned monetary totals
- Primary `Add Line Item` action placed below the table (not embedded in header cells)

Not allowed for line-items sections:

- Accordion-only presentation for the line-items block
- Decorative alternate table skins that diverge from the canonical pattern
- Per-page reinvention of spacing/typography for line-item grids

Primary design reference: `docs/design/DESIGN.md`

### 9. Global Primitive Consistency (MANDATORY)

Design fixes must be applied at the shared primitive/component level when the issue originates there.

Required behavior:

- If the defect comes from a shared primitive (`components/ui/*`, shared layout/table primitives), fix that primitive globally.
- Page-level or feature-level visual overrides are forbidden as a default fix path.
- Do not apply local overrides to compensate for primitive defects. Fix the primitive instead.
- A local override is allowed only in a rare, explicitly requested exception. It must include an inline TODO that states why the shared primitive cannot own the behavior yet, plus a follow-up task to move the behavior into the primitive.
- Never bypass design-system lint rules using force flags (`--force`, `--no-verify`) to push style drift.

Decision rule:

- First determine whether the styling is owned by a primitive or a page.
- Primitive-owned issue -> global fix.
- Page-owned issue -> local fix aligned to tokens and shared patterns.

---

## Development Commands

```bash
# From repo root
npm run dev                    # frontend + backend concurrently
npm run dev:frontend           # Next.js only (port 3000)
npm run db:types               # regenerate Supabase types + schema FK map
npm run db:types:check         # verify generated Supabase types are current
npm run db:push                # apply Supabase migrations, then regenerate types
npm run db:migrations:verify-clean # verify local/remote Supabase migration ledger
npm run check:routes           # verify no dynamic route conflicts
npm run validate:runtime-config # validate required runtime configuration
npm run quality:predeploy      # full predeploy quality gate
npm run verify:postdeploy      # post-deploy verification checks
npm run verify:active-backend-url # confirm frontend/backend URL wiring
npm run rag:verify:render-ai   # verify Render AI Gateway health
npm run rag:verify:source-provider-auth # verify source processing provider auth
npm run rag:verify:metadata-boundary # guard AI/RAG document_metadata selects
npm run rag:verify:chunk-integrity # verify RAG chunk integrity
npm run worker-status -- <YYYY-MM-DD> # summarize orchestration handoff status

# From frontend/ directory
npm run build                  # production build
npm run quality                # typecheck + lint
npm run quality:fix            # typecheck + lint with auto-fix
```

## Drawing OCR Commands

```bash
# Manual OCR backfill; use a real admin key from secure env, never commit it
curl -X POST "https://alleato-backend-rbnj.onrender.com/api/admin/documents/ocr-backfill" \
  -H "Authorization: Bearer <ADMIN_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 30, "page_cap": 20}'
```

OCR status lives on `document_metadata.status`: `no_text` -> `raw_ingested` for full OCR, `ocr_partial` when the page cap is hit but text is still embedded, and `ocr_failed` for failures that require a manual reset to `no_text` before retry. Reference: `docs/architecture/OCR-PIPELINE.md`.

Script ownership source of truth: `scripts/README.md`. Root-level legacy script inventory: `scripts/ROOT-SCRIPTS.md`. New supported tooling should live under an owner folder in `scripts/` and be exposed through `package.json` when intended for routine use.

## Testing Commands

```bash
# From repo root (default browser verification path)
npm run verify:browser           # agent-browser run with screenshots + video + markdown summary
npm run verify:browser:cleanup   # remove agent-browser artifacts older than 48h
npm run verify:api:contracts     # API smoke contract verification
npm run test:route-guardrails    # unit coverage for route guardrail enforcement

# From frontend/ directory
npm run test                   # Playwright E2E (headless)
npm run test:headed            # Playwright with browser visible
npm run test:ui                # Playwright UI mode
npm run test:unit              # Jest unit tests
npm run test:unit:watch        # Jest watch mode
npm run test:auth              # refresh/check saved Playwright auth session
npm run test:trace             # Playwright run with trace capture

# Run a specific Playwright spec
npx playwright test tests/e2e/budget-line-item-validation.spec.ts --headed
```

**agent-browser verification artifacts:**

- Output root: `tests/agent-browser-runs/<timestamp>-<run-name>/`
- Required evidence per run: `session.webm`, before/after screenshots, snapshots, action log, `VERIFICATION_SUMMARY.md`
- Optional scripted actions file template: `scripts/templates/agent-browser-actions.example.txt`

**Auth is pre-configured.** Playwright uses saved session at `tests/.auth/user.json`. Never add login code to individual tests. If the session expires, run `npx playwright test tests/auth.setup.ts` once to refresh it.

**Credential source of truth:**

- For Alleato app login (`projects.alleatogroup.com`, local app auth pages, Playwright auth refresh), use `.env` `TEST_USER_1` / `TEST_PASSWORD_1`. `APP_USERNAME` / `APP_PASSWORD` are equivalent aliases.
- For Procore login and Procore crawl scripts, use `.env` `PROCORE_USER` / `PROCORE_PASSWORD`.
- Never use `PROCORE_USER` / `PROCORE_PASSWORD` to log into the Alleato app unless the user explicitly says the app is configured to share those credentials.

**Agent-browser auth rule:** when `agent-browser` hits an authenticated page and redirects to login, do not treat auth as a blocker. Choose credentials based on the target system:

- Alleato app -> `TEST_USER_1` / `TEST_PASSWORD_1`
- Procore -> `PROCORE_USER` / `PROCORE_PASSWORD`
  If the first login attempt fails, verify that the correct credential family was used before reporting an auth blocker.

### Mandatory authenticated-browser readiness gate

For every user-facing task that requires browser, visual, or end-to-end proof,
authentication is a kickoff prerequisite—not a closeout activity. Before
implementation begins, the agent must establish and verify a fresh authenticated
browser session for the canonical protected route.

1. Start the target local runtime, then run the repository-owned verifier from
   the repo root:

   ```bash
   npm run verify:browser -- --url "http://localhost:<port>/<protected-route>" --name "<task>-auth-preflight"
   ```

   This verifier is the canonical path: it refreshes
   `frontend/tests/.auth/user.json` when missing or expired, loads that state
   into a new agent-browser session, checks that the route did not land on
   `/auth/login`, and records screenshots, video, snapshots, console/errors,
   and a markdown summary.

2. Record the preflight artifact directory and authenticated landing URL in the
   task markdown/handoff before writing user-facing behavior. A login-page
   screenshot, an arbitrary global agent-browser session, or a browser state
   under a user home directory is not valid proof.

3. Use a fresh task-scoped agent-browser session for follow-up interactions and
   close it after the run. Do not reuse an unknown or stalled global session.
   Use the canonical `frontend/tests/.auth/user.json` state, never copied
   cookies or an unverified historical state file.

4. If the verifier fails, run its built-in auth-refresh path once more with the
   same URL. Only after that retry may the task be marked `Blocked/Deferred`.
   The blocker report must include the verifier's exact command, final URL,
   artifact directory, cause, detection gap, prevention step, and next owner
   action. Do not defer browser proof merely because a raw `agent-browser`
   command redirected or hung.

5. The final browser proof must come from a successful preflight-derived
   session on the same revision. Do not reuse an older screenshot after source
   changes.

**Enforcement:** raw `agent-browser open` commands to protected Alleato routes
are prohibited unless they load `frontend/tests/.auth/user.json`. The repository
hook blocks anonymous navigation and prints the exact preflight command. A raw
redirect to `/auth/login` is not an authentication blocker and must never be
reported as one. Only `npm run verify:browser-auth` may establish an auth
blocker, after its refresh, daemon reset, and retry have all failed.

---

## Supabase Client Usage

- **Browser / client components:** `import { createClient } from "@/lib/supabase/client"` (singleton)
- **Server components / API routes:** `import { createClient } from "@/lib/supabase/server"` (new instance per request)

**Never install** `@supabase/auth-helpers-nextjs` — it conflicts with `@supabase/ssr` and crashes the dev server with cryptic webpack errors. Check: `npm list | grep auth-helpers` before any Supabase work.

---

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **UI:** shadcn/ui, Radix UI primitives, Framer Motion
- **State:** React Query (TanStack Query), Zustand
- **Backend:** Supabase (PostgreSQL, Auth, RLS), Python FastAPI
- **Testing:** agent-browser (primary interactive E2E), Playwright (scripted/CI E2E), Jest (unit)
- **Forms:** React Hook Form + Zod validation

---

## Code Implementation

- Conform to codebase conventions: follow existing patterns, helpers, naming, formatting.
- Comprehensiveness: wire all relevant surfaces so behavior stays consistent across the app.
- Tight error handling: no broad `try/catch` or silent fallbacks; propagate errors explicitly.
- Efficient edits: read enough context before changing a file; batch logical edits together.
- Type safety: changes must pass `tsc --noEmit`; avoid `as any`, `as unknown as ...`; reuse existing types from `database.types.ts`.
- DRY: search for prior art before adding new helpers or logic.
- Bias to action: implement with reasonable assumptions; don't end on clarifications unless truly blocked.

---

## File Organization

| File type                 | Location                                     |
| ------------------------- | -------------------------------------------- |
| Scripts (.js/.ts/.py/.sh) | `scripts/`                                   |
| SQL migrations            | `supabase/migrations/`                       |
| Frontend source           | `frontend/src/`                              |
| E2E tests                 | `frontend/tests/`                            |
| Claude/Codex rules        | `.claude/rules/`                             |
| PRPs / feature specs      | external planning system; ephemeral local output lives under `tmp/bmad-output/` |
| Docs                      | `docs/`                                      |

Never create `.md`, `.js`, `.ts`, `.py`, or `.sh` files at project root (except `CLAUDE.md`, `AGENTS.md`, `README.md`).

---

## Editing Constraints

- Default to ASCII. Only introduce non-ASCII characters when the file already uses them.
- Do not amend a commit unless explicitly requested.
- **NEVER** use destructive commands (`git reset --hard`, `git checkout --`) unless specifically approved.
- If you notice unexpected changes you didn't make: STOP and ask the user how to proceed.
- Do not revert existing changes you did not make unless explicitly asked.

---

## Exploration and Reading Files

- **Think first.** Before any tool call, decide ALL files/resources you will need.
- **Batch everything.** Read multiple files together in a single parallel call.
- **Use `multi_tool_use.parallel`** to parallelize tool calls — only this mechanism, not scripting.
- Sequential calls only when you truly cannot know the next file without seeing a prior result.
- Workflow: (a) plan all needed reads → (b) issue one parallel batch → (c) analyze → (d) repeat only if new reads arise.

---

## Plan Tool

- Skip for straightforward tasks (roughly the easiest 25%).
- Do not make single-step plans.
- Update the plan after completing each sub-task.
- Never end an interaction with only a plan — the deliverable is working code.
- Plan closure: reconcile every TODO. Mark each as Done, Blocked (reason + targeted question), or Cancelled. No in-progress items at end.
- Only update the plan tool — do not message the user mid-turn about plan updates.

---

## Presenting Work

- Default: concise, friendly coding teammate tone.
- Lead code explanations with a quick explanation of the change, then context (where/why).
- For substantial work, summarize clearly; offer logical next steps briefly.
- Don't dump large files you've written — reference paths only.
- File references: use inline code; each reference standalone. Accepted: `src/app.ts`, `src/app.ts:42`, `frontend/src/hooks/use-budget.ts:87`.
- No nested bullets; no ANSI codes.
- If there are natural next steps, suggest them at the end as a numeric list for quick response.
