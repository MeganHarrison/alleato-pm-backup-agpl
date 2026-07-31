---
description: "Create a PRP for internal/custom Alleato features (NOT Procore parity). Researches the codebase, schema, and requirements to produce a one-pass implementation blueprint. For Procore replication features use /prp:prp-create instead."
argument-hint: "<feature-name>"
---

# Create Internal Feature PRP

## Feature: $ARGUMENTS

## Mission

Create a comprehensive PRP that enables **one-pass implementation success** for an internal Alleato feature. This document answers: "What exactly needs to be built, and where does every piece go?"

**Critical understanding**: The agent that executes this PRP receives only:
- The PRP content you create
- Access to the codebase (but needs to be told which files to look at)
- Its training knowledge

**Incomplete context = implementation failure.** Optimize for completeness, not speed.

**This skill is for:** dashboards, automation features, alert systems, internal tools, AI features, reporting, cron jobs — anything that isn't a direct Procore clone.

**For Procore parity features:** use `/prp:prp-create` instead.

---

## Research Process

> Spawn subagents in parallel wherever possible.

### Step 1: Understand the Problem Space

Before touching the codebase, answer these from the user's description:

- **Who uses this?** (role: PM, accounting, CEO, admin)
- **What pain does it solve?** (be specific — quote the actual incident if one exists)
- **What does "done" look like?** (observable behavior, not implementation details)
- **What are the open questions?** (things that must be answered before implementation can start)

If any of these are unclear, **ask the user before proceeding**. A PRP written on wrong assumptions is worse than no PRP.

---

### Step 2: Alleato Codebase Research (Spawn in parallel)

Run these as subagents simultaneously:

#### 2a. Existing Pattern Discovery
```bash
# Find the closest existing feature to reference
# For table/list pages:
cat frontend/src/app/\(main\)/\[projectId\]/commitments/page.tsx
cat frontend/src/features/commitments/commitments-table-config.ts

# For API routes — find similar domain:
ls frontend/src/app/api/projects/\[projectId\]/

# For dashboard widgets/cards:
cat frontend/src/components/ds/GOLDEN-EXAMPLES.tsx

# For notification/alert patterns:
grep -r "resend\|sendEmail\|Teams" frontend/src/app/api/ --include="*.ts" -l

# For cron jobs:
cat render.yaml | grep -A5 "cron"
```

#### 2b. Database Schema Research
```bash
# ALWAYS run this first before any DB work
cd frontend && npm run db:types

# Then read the generated types for relevant tables
# Search for tables the feature will touch:
grep -n "tablename" frontend/src/types/database.types.ts | grep -i "<table-name>"

# Check existing hooks for the same domain:
ls frontend/src/hooks/use-*.ts | grep -i "<domain>"
```

#### 2c. Design System Constraints
```bash
# Check what DS components exist before planning any UI
ls frontend/src/components/ds/

# Read the golden examples
cat frontend/src/components/ds/GOLDEN-EXAMPLES.tsx

# Check existing page shell variants:
grep -r "PageShell" frontend/src/app/\(main\)/ --include="*.tsx" -l | head -5
```

#### 2d. CLAUDE.md Constraint Review
Read and note every relevant constraint from `CLAUDE.md` and `.claude/rules/` that applies to this feature:
- Route naming conventions (`[projectId]` not `[id]`)
- API client requirements (`apiFetch` not raw `fetch`)
- Table page requirements (if this has a list view)
- Design system rules (no hardcoded colors, no raw `<button>`)
- Supabase client selection (client vs server)

---

### Step 3: External Research (Only If Needed)

For features involving external APIs, libraries, or patterns not in the codebase:

```bash
# Research with specific URLs — include section anchors
# Examples:
# Resend email API: https://resend.com/docs/api-reference/emails/send-email
# Supabase cron: https://supabase.com/docs/guides/database/postgres/pg-cron
# React Query: https://tanstack.com/query/latest/docs/framework/react/guides/...
```

Only fetch docs when the codebase doesn't already show the pattern. Prefer reading existing working code over external docs.

---

### Step 4: Open Questions Gate

**Before writing the PRP**, list every question that must be answered to implement correctly.

These are typically:
- Which exact DB column/table is the source of truth?
- What triggers this feature (event, cron, user action)?
- Who has permission to see/use this?
- What happens when the data is missing or empty?
- Is there a grace period / suppression logic?
- What's the alert delivery channel (email, Teams, in-app)?
- Does this work across all projects or scoped to specific ones?

If any question is **blocking** (can't write the PRP without the answer), ask the user now. If it's **non-blocking** (can make a reasonable default), note it as an open question in the PRP with the chosen default.

---

## PRP Generation

### Required Sections

#### 1. Problem Statement & Business Impact
- What specific, real incident or pain point does this address?
- Who is affected and how often?
- What does the business risk if this stays unbuilt?
- Success metric: how will we know this is working?

#### 2. Feature Overview
- What it does in plain language (one paragraph)
- Scope: what's in, what's explicitly out
- User-facing or background automation?
- Related features it connects to

#### 3. Data Model
For each table touched:
- Table name (verified in `database.types.ts`)
- Columns read/written (exact names from generated types)
- Any new columns or tables required (include DDL)
- FK relationships relevant to this feature

```sql
-- New columns / tables (if any):
ALTER TABLE ... ADD COLUMN ...;
```

#### 4. API Routes
For each endpoint:
```
METHOD /api/path/[param]/action
- Auth: required / admin only / public
- Input: { field: type }
- Output: { field: type }
- Errors: what can go wrong and what status code
- Source table(s): which Supabase tables
```

#### 5. UI Specification (if applicable)
- Page route: exact Next.js App Router path
- PageShell variant: `table` | `dashboard` | `form` | `detail` | `content`
- Components to use from `@/components/ds/` (check GOLDEN-EXAMPLES.tsx)
- If list/table: invoke `alleato-table-page` skill for UnifiedTablePage spec
- Mobile: how does this collapse/stack on small screens?
- Empty state: what shows when there's no data?
- Error state: what shows on load failure?

#### 6. Background Jobs / Automation (if applicable)
For each cron job:
```yaml
# render.yaml addition:
- name: alleato-<job-name>
  type: cron
  schedule: "0 8 * * 1"  # cron expression
  command: "node scripts/<script-name>.js"
```
- What does the job query?
- What does it send / write?
- Idempotency: is it safe to run twice?
- Failure handling: what happens if it errors?

#### 7. Notification Spec (if applicable)
- Trigger condition (exact logic / SQL)
- Recipients (who gets it, how determined)
- Channel: email (Resend) / Teams DM / in-app
- Frequency / deduplication (prevent spam)
- Template content (subject, body structure)
- Suppression conditions (when NOT to send)

#### 8. Permissions & Roles
- Who can view this?
- Who can trigger/approve actions?
- RLS implications (does this need a new policy?)
- Admin vs project-level access?

#### 9. Implementation Task List

Order tasks by dependency. Each task must be specific enough that an agent can execute it without guessing:

```
Task 1: [DB] Add migration for new columns
- File: supabase/migrations/YYYYMMDD_<description>.sql
- Pattern: follow existing migrations in supabase/migrations/
- Run: npm run db:types after applying

Task 2: [API] Create GET /api/projects/[projectId]/accounting/ap-aging
- File: frontend/src/app/api/projects/[projectId]/accounting/ap-aging/route.ts
- Pattern: follow frontend/src/app/api/projects/[projectId]/contracts/route.ts
- Auth: createClient from @/lib/supabase/server
- Query: <exact query description>

Task 3: [Hook] Create useApAging hook
- File: frontend/src/hooks/use-ap-aging.ts
- Pattern: follow frontend/src/hooks/use-contracts.ts
- React Query key: ['ap-aging', projectId]

Task 4: [UI] Build AP aging page
- File: frontend/src/app/(main)/[projectId]/accounting/ap-aging/page.tsx
- PageShell variant: table
- Uses: UnifiedTablePage (invoke alleato-table-page skill)
- Config: frontend/src/features/accounting/ap-aging-table-config.ts

Task 5: [Cron] Add cron job to render.yaml
...
```

#### 10. Validation Gates

**Level 1 — Type Safety**
```bash
cd frontend && npm run typecheck
```
Must pass with zero errors.

**Level 2 — Lint**
```bash
cd frontend && npm run lint
```
Must pass. Fix violations — do not add `eslint-disable`.

**Level 3 — Quality Gate**
```bash
cd frontend && npm run quality
```
Combined typecheck + lint. This is the pre-commit gate.

**Level 4 — Smoke Test**
```bash
# Curl each new API route:
curl http://localhost:3000/api/projects/67/accounting/ap-aging
# Must return 200 with expected shape, not 500

# Add to: scripts/api-smoke-test.sh
```

**Level 5 — Browser Verification** (UI features only)
```bash
# Use agent-browser to:
# 1. Navigate to the new page
# 2. Screenshot it
# 3. Verify data is rendering, not empty/erroring
# Credentials: TEST_USER_1 / TEST_PASSWORD_1 from .env
```

#### 11. Anti-Patterns to Avoid

List the specific mistakes most likely for this feature:

| Don't | Do Instead |
|-------|-----------|
| `fetch("/api/...")` in component | `apiFetch` from `@/lib/api-client` |
| Raw `<button>` | `<Button>` from `@/components/ui/button` |
| `gray-500`, `#3b82f6` | Semantic tokens: `text-muted-foreground`, `bg-primary` |
| `[id]` in route param | `[projectId]`, `[contractId]`, etc. |
| `createClient()` at module level in server | Inside the handler function |
| Manual `useState` for table search/sort | `useUnifiedTableState` |
| Hand-rolled empty state | `<EmptyState>` from `@/components/ds` |

Add feature-specific ones based on your research.

#### 12. Open Questions
List anything that requires a decision before or during implementation. Include the chosen default if you made one:

```
Q: Should the cash alert fire on weekends?
Default chosen: No — only weekdays. Change accounting_alert_settings.weekend_alerts to true to override.
Status: Non-blocking (default chosen)

Q: What's the minimum balance threshold for the initial deploy?
Status: BLOCKING — needs answer from Misty Rogers before implementation
```

---

## Output

Save as: `docs/PRPs/<domain>/prp-<feature-name>.md`

Domain examples: `accounting-automation`, `ai-intelligence`, `reporting`, `integrations`, `wip-psr`

---

## Quality Gates

Before marking complete:

- [ ] Problem statement includes a real incident or quantified pain point
- [ ] All DB tables verified in `database.types.ts` (not assumed)
- [ ] All new columns include DDL
- [ ] Every API route has method, path, auth, input, output, errors
- [ ] Every UI component checked against `@/components/ds/` first
- [ ] Cron jobs include render.yaml YAML snippet
- [ ] Notification spec includes suppression/deduplication logic
- [ ] Implementation tasks are ordered by dependency
- [ ] Each task names the exact file to create/modify and a reference pattern to follow
- [ ] All 5 validation levels are specified with exact commands
- [ ] Anti-patterns table is populated with feature-specific entries
- [ ] Open questions section explicitly flags any blockers
- [ ] Output path is `docs/PRPs/<domain>/prp-<feature-name>.md`

## Confidence Score

Rate 1–10: how likely is one-pass implementation success if an agent only reads this PRP?

**Minimum 8/10 required.** If lower, identify the gaps and fill them before saving.

Common reasons for low scores:
- Task descriptions say "implement X" without naming the file and reference pattern
- DB columns not verified against generated types
- UI spec missing empty/error states
- Cron job missing idempotency/failure handling
- Open questions left as blockers without flagging them
