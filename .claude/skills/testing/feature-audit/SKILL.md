---
name: feature-audit
description: >
  Comprehensive feature audit combining functional testing, Procore compliance,
  and usability recommendations. Reads the existing test matrix, PRP, and Procore
  manifests — then tests in the browser, validates the database, compares against
  Procore behavior, and produces improvement recommendations. Use when: "audit [tool]",
  "feature audit [tool]", "full test [tool]", "review [tool] quality",
  "what's wrong with [tool]", "how can we improve [tool]", or any request for a
  thorough quality assessment with actionable recommendations.
argument-hint: <tool-name>
---

# Feature Audit

Comprehensive quality assessment: functional testing + Procore compliance + usability recommendations.

**Invocation:** `/feature-audit <tool-name>`

**Example:** `/feature-audit drawings`

**Time:** ~30-60 minutes

**Output:** `feature-audit-output/<tool>/report.md` — unified report with pass/fail results, Procore compliance matrix, usability findings, and prioritized improvement recommendations.

---

## What This Does

| Phase | What | Time |
|-------|------|------|
| 1. Context Assembly | Read test matrix, PRP, manifest, query Procore docs, inventory code | ~2 min |
| 2. Functional Testing | Execute HIGH + MEDIUM tests from matrix, DB validation, FK checks | ~10-15 min |
| 3. Procore Compliance | Compare fields, statuses, workflows against Procore spec | ~5 min |
| 4. Usability & Architecture | Code review for perf, library choices, missing capabilities, UX gaps | ~5-10 min |
| 5. Report & Fix | Write report, fix Critical/High issues inline | ~5-10 min |

## Non-Negotiable Audit Gates

An audit is invalid unless all required artifacts exist for the tested flows.

### Required artifacts before report closure

For every audited flow that includes a form, the audit must capture:
- A screenshot of the empty or starting state
- A screenshot of the form before submit
- A screenshot of the success or resulting state
- Database validation output for the saved record
- Edit prefill verification after reload

For every failure, the audit must capture:
- A screenshot of the failure state
- A short reproduction note
- If applicable, a failure video

### Mandatory form-completion rule

If a feature has a create or edit form, you must complete the form end-to-end and verify persistence before moving to the next phase.

This means:
- Fill every required field
- Fill representative optional fields that Procore exposes
- Submit the form
- Reload or revisit the record
- Confirm the saved values are still present

If the feature includes related nested forms or sub-forms, at least one complete pass through each nested form is required before the audit can advance.

### Per-flow audit checklist

Every audited form flow must be marked complete only after all of the following are done:
- `Create` flow completed and saved
- `Edit` flow completed and saved
- `Reload` or reopen verification completed
- `DB` validation completed for the saved record
- `Negative path` test completed for the same form
- `Artifacts` captured for each state

If any item is missing, the flow is incomplete and the audit cannot advance to the report phase.

---

## Phase 1: Context Assembly (Parallel)

Launch 3 sub-agents simultaneously. All sources are at known paths — no searching needed.

### Sub-agent 1: Test Matrix & Scenarios

Read and parse:
```
docs/testing/<tool-name>-test-matrix.md
docs/testing/<tool-name>-scenarios.md
```

Extract:
- Every test case grouped by priority (HIGH, MEDIUM, LOW)
- Total test count
- Known gaps listed at the bottom of the scenarios doc

### Sub-agent 2: Procore Spec (PRP + Manifest + Docs RAG)

Read:
```
_bmad-output/planning-artifacts/<tool-name>/prp-<tool-name>.md
.claude/procore-manifests/<tool-name>/manifest.json
```

Query Procore docs RAG (2-3 queries):
```bash
node scripts/procore-docs-query.js "<tool-name> workflow statuses fields"
node scripts/procore-docs-query.js "<tool-name> form fields required optional"
node scripts/procore-docs-query.js "<tool-name> relationships integrations"
```

Produce a Procore spec summary:
- Fields Procore has (with required/optional)
- Status values and transitions
- Workflows and business rules
- Integrations with other tools

### Sub-agent 3: Codebase Inventory & Architecture Review

Inventory (use glob/grep, not search):
```
Pages:      frontend/src/app/(main)/[projectId]/<tool-name>/
API routes: frontend/src/app/api/projects/[projectId]/<tool-name>/
Hooks:      frontend/src/hooks/use-<tool-name>*.ts
Components: frontend/src/components/<tool-name>/  (or components/domain/<tool-name>/)
Types:      frontend/src/types/<tool-name>.types.ts
Schemas:    frontend/src/lib/schemas/<tool-name>*.ts
Features:   frontend/src/features/<tool-name>/
```

For each component file, note:
- File size (lines) — flag anything > 400 lines for refactoring
- Key libraries used (e.g., react-pdf, canvas, specific charting libs)
- Design system compliance (imports from @/components/ds vs raw HTML)
- Any TODO/FIXME/HACK comments

**Wait for all 3 sub-agents before continuing.**

---

## Phase 2: Functional Testing (~10-15 minutes)

### 2.0 Setup

```bash
mkdir -p feature-audit-output/<tool-name>/screenshots feature-audit-output/<tool-name>/videos

# Check dev server
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Start session
agent-browser --session audit-<tool> open http://localhost:3000/$PROJECT_ID/<tool-name>
agent-browser --session audit-<tool> wait --load networkidle
```

Authenticate if redirected (same login-once pattern used by `/test-scenario-run`).

### 2.1 Execute Test Matrix (HIGH + MEDIUM priority)

Work through the test matrix sequentially. For each test:

```bash
# Navigate to starting state
agent-browser --session audit-<tool> open <url>
agent-browser --session audit-<tool> wait --load networkidle
agent-browser --session audit-<tool> snapshot -i

# Execute the test steps
agent-browser --session audit-<tool> fill @eN "value"
# ... complete all steps

# Capture result
agent-browser --session audit-<tool> screenshot feature-audit-output/<tool-name>/screenshots/test-<id>.png

# Check for errors
agent-browser --session audit-<tool> errors
```

**Use `fill` everywhere. No `type`. No video for passing tests.**

Record the result for each test: PASS, FAIL, or SKIP (with reason).

### 2.2 Database Validation (after every create/update)

For every create or update operation, verify ALL fields in the database:

```bash
COOKIE=$(agent-browser --session audit-<tool> eval 'document.cookie' 2>/dev/null)

curl -s -H "Cookie: $COOKIE" \
  "http://localhost:3000/api/projects/$PROJECT_ID/<tool-name>?sort=created_at&order=desc&limit=1" | jq .
```

Check:
- Every required field has a value
- Values match what was entered
- No silently dropped fields (null when a value was entered)
- FK columns resolve to the correct related record (JOIN check)

### 2.2.1 Form Completion Proof

Before moving past a form-based test case, capture proof that the form was actually completed:
- Record the values entered for required and optional fields
- Verify the create/update response or DB row contains those values
- Reload the page or reopen the record and verify the values still exist
- If the form has nested sub-forms, verify at least one nested item persisted

### 2.2.2 Required flow order

For each form-based feature, execute tests in this order:
1. Create
2. Edit
3. Reload / reopen verification
4. DB validation
5. Negative path

Do not skip ahead to compliance comparison or usability review until the full flow order is complete for the tested record.

### 2.3 FK & Edit Pre-fill Check (Gate 11)

After creating a record with dropdown selections:

```bash
# Navigate away
agent-browser --session audit-<tool> open http://localhost:3000/$PROJECT_ID/<tool-name>
agent-browser --session audit-<tool> wait --load networkidle
sleep 1

# Navigate back to the record
agent-browser --session audit-<tool> open <record-url>
agent-browser --session audit-<tool> wait --load networkidle

# Click Edit
agent-browser --session audit-<tool> snapshot -i
agent-browser --session audit-<tool> click @eN  # Edit button
agent-browser --session audit-<tool> wait --load networkidle
sleep 1

# Screenshot and verify every dropdown shows saved value
agent-browser --session audit-<tool> screenshot feature-audit-output/<tool-name>/screenshots/edit-prefill.png
agent-browser --session audit-<tool> snapshot
```

For every dropdown: does it show the saved value or a placeholder ("Select...")?
- Placeholder = **Critical** bug (FK mismatch)
- Correct value = PASS

### 2.4 Negative Path Tests

From the test matrix, execute all validation tests:
- Submit empty form → validation errors shown
- Missing required fields → specific error messages
- Invalid data → rejected gracefully
- Duplicate constraints → appropriate error (e.g., 409)

### 2.5 Status Transitions (if applicable)

If the tool has status workflows:
- Execute each valid transition
- Verify status badge updates
- Verify DB status column matches
- Attempt invalid transitions → blocked or hidden

### 2.6 Record video for failures only

When a test fails:

```bash
agent-browser --session audit-<tool> record start feature-audit-output/<tool-name>/videos/fail-<test-id>.webm
# Reproduce the failure
sleep 1
agent-browser --session audit-<tool> screenshot --annotate feature-audit-output/<tool-name>/screenshots/fail-<test-id>.png
agent-browser --session audit-<tool> record stop
```

---

## Phase 3: Procore Compliance (~5 minutes)

Using the Procore spec from Phase 1, compare against our implementation:

### 3.1 Field Comparison

For every field Procore has:
- Do we have it? (check form components and DB schema)
- Same name/label?
- Same type (text/select/date/number)?
- Same required/optional status?

### 3.2 Status & Workflow Comparison

For every Procore status value:
- Do we have it?
- Same transitions?
- Same business rules?

### 3.3 Feature Comparison

For every Procore capability:
- Do we have it?
- If not, is it intentionally excluded or a gap?

### Classification

| Verdict | Meaning |
|---------|---------|
| **Match** | Our implementation matches Procore behavior |
| **Gap** | Procore has it, we don't — needs assessment (not automatically a bug) |
| **Custom** | We have it, Procore doesn't — intentional addition |
| **Mismatch** | We have it but it works differently than Procore — needs review |

---

## Phase 4: Usability & Architecture Review (~5-10 minutes)

This is the unique value of `/feature-audit` over other skills. It produces actionable
improvement recommendations, not just pass/fail results.

### 4.1 Performance Assessment

Read the main component files identified in Phase 1. Check:

**Library choices:**
- What PDF viewer library is used? Is there a faster/better alternative?
- What table/grid library? Is it appropriate for the data volume?
- Any heavy dependencies that could be replaced with lighter ones?
- Are images/assets lazy-loaded?

**Load time observations:**
- During Phase 2 testing, note any pages that take > 2 seconds to load
- Check for unnecessary re-renders (large component files doing too much)
- Check for N+1 query patterns in API routes

**Bundle concerns:**
- Are large libraries dynamically imported (`next/dynamic`)?
- Any client-side imports that could be server-side?

### 4.2 Missing Capabilities

Compare our feature set against:
1. **Procore's full capability list** (from Phase 1 sub-agent 2)
2. **Industry expectations** for this type of tool
3. **Cross-tool integration** (does this tool connect to related tools properly?)

Common gaps to check:
- Drag-and-drop reordering
- Bulk operations (bulk delete, bulk edit, bulk export)
- Keyboard shortcuts
- Offline support (relevant for construction field use)
- Mobile responsiveness
- Print/export capabilities
- Undo/redo
- Real-time collaboration indicators

### 4.3 UX Quality Assessment

Using screenshots from Phase 2 and the dogfood issue taxonomy categories:

**Navigation & Information Architecture:**
- Is the feature easy to find? Clear path from project home?
- Are tabs/sub-pages logically organized?
- Can user always get back to where they were?

**Forms & Input:**
- Are required fields marked?
- Are validation messages clear and positioned correctly?
- Do forms remember state if the user navigates away accidentally?
- Are there sensible defaults?

**Feedback & Affordances:**
- Do actions have loading indicators?
- Are success/error toasts shown?
- Do destructive actions have confirmation dialogs?
- Are empty states helpful (not just "No data")?

**Visual Quality:**
- Does it follow the design system? (Check Phase 1 sub-agent 3 findings)
- Consistent spacing and typography?
- Mobile-responsive?

### 4.3b Design Consistency Checklist (Mandatory — Run on Every File in Scope)

This is non-negotiable. Run these grep checks and flag every hit as a violation. These are design-101 issues that should never reach review.

```bash
# 1. Raw heading tags used as section headings (should be SectionRuleHeading)
grep -r "<h[234]" frontend/src/components/domain/<tool> frontend/src/app/(main)/\[projectId\]/<tool> --include="*.tsx"

# 2. Hand-rolled empty states (should be <EmptyState> from @/components/ds)
grep -r "py-16 text-center\|rounded.*border.*text-center\|No.*yet.*<p\|Coming soon" frontend/src/components/domain/<tool> --include="*.tsx"

# 3. Raw <button> elements (should be <Button> from @/components/ui/button)
grep -r "<button " frontend/src/components/domain/<tool> --include="*.tsx"

# 4. Hardcoded colors (should be semantic tokens only)
grep -r "text-gray-\|text-neutral-\|text-zinc-\|bg-white\|bg-gray-\|#[0-9a-fA-F]" frontend/src/components/domain/<tool> --include="*.tsx"

# 5. Spacing at callsite instead of in component
grep -rA2 "SectionRuleHeading" frontend/src/components/domain/<tool> --include="*.tsx" | grep "mt-\|space-y-6"

# 6. Tab consistency — if the tool has a detail page with multiple tabs,
#    list all tab components and verify each uses SectionRuleHeading (not h3),
#    EmptyState (not hand-rolled), and the same content width wrapper.
```

**For each violation found:**
- Severity: HIGH for items 1–3, MEDIUM for 4–5
- Fix it inline (don't just report it)
- Note it in the report under "Design Consistency Violations"

**The standard:** Every section heading = `SectionRuleHeading`. Every empty state = `<EmptyState>`. Every button = `<Button>`. No exceptions. These are not style preferences — they are the only correct implementation.

### 4.4 Code Quality Observations

From the codebase inventory in Phase 1:

- Files > 400 lines that should be refactored
- Components with too many responsibilities
- Missing error boundaries
- Missing loading states
- Hardcoded values that should be configurable
- TODO/FIXME items that are stale

---

## Phase 5: Report & Fix (~5-10 minutes)

### 5.1 Fix Critical and High Issues

For every Critical or High finding from Phase 2:
1. Read the relevant source file
2. Identify root cause
3. Apply minimal fix
4. Re-test the specific flow
5. Screenshot the fix
6. Note in the report: FIXED with root cause and change

### 5.2 Write the Report

Copy template and fill:

```bash
cp {SKILL_DIR}/templates/feature-audit-report-template.md feature-audit-output/<tool-name>/report.md
```

The report must not be finalized until the following are complete:
- All required form-completion artifacts are present
- All screenshot paths referenced in the report exist
- All fixed issues were re-verified in the browser
- Every open issue includes a concrete reproduction path

Read every screenshot with the Read tool before finalizing.

### 5.3 Close Session

```bash
agent-browser --session audit-<tool> close
```

### 5.4 Present Summary

Tell the user:
1. **Overall verdict** (PASS / FAIL / PARTIAL)
2. **Test matrix execution** — X of Y tests passed
3. **Procore compliance** — X matches, Y gaps, Z mismatches
4. **Top 3 usability findings** — the most impactful UX improvements
5. **Top 3 architecture recommendations** — the most impactful technical improvements
6. **Issues fixed** — what was fixed during the audit
7. **Issues remaining** — what needs manual attention

---

## Improvement Recommendations Format

Every recommendation must follow this structure:

```markdown
### REC-001: {Title}

| Field | Value |
|-------|-------|
| **Category** | Performance / Missing Capability / UX / Architecture / Procore Gap |
| **Impact** | High / Medium / Low |
| **Effort** | S (< 1hr) / M (1-4hr) / L (half day) / XL (1+ day) |
| **Priority** | {Impact × 1/Effort — High impact + Low effort = do first} |

**Current state:** {What exists now}
**Recommended:** {What should change}
**Why:** {User impact or technical benefit}
**How:** {Specific files to modify, libraries to add/replace, patterns to follow}
```

### Priority Matrix

Recommendations are sorted by impact-to-effort ratio:

| | Low Effort (S/M) | High Effort (L/XL) |
|---|---|---|
| **High Impact** | **Do First** | **Plan Next** |
| **Medium Impact** | **Quick Win** | **Backlog** |
| **Low Impact** | **If Time** | **Skip** |

---

## Speed Rules

- **Use `fill` everywhere.** Never `type`.
- **Video only for failures.** Not for passing tests.
- **Read existing docs first.** Don't regenerate research that exists in the test matrix/PRP.
- **Sleep only after navigation/submit.** Not between fill calls.
- **Fix Critical/High inline.** Don't just report — fix and re-verify.
- **Be specific in recommendations.** "Consider using library X instead of Y" with a link, not "improve performance."

---

## agent-browser Quick Reference

| Command | Purpose |
|---------|---------|
| `agent-browser --session {S} open {url}` | Navigate |
| `agent-browser --session {S} wait --load networkidle` | Wait for page |
| `agent-browser --session {S} snapshot -i` | Get interactive refs |
| `agent-browser --session {S} snapshot` | Read page content |
| `agent-browser --session {S} click @eN` | Click |
| `agent-browser --session {S} fill @eN "text"` | Fill input (fast) |
| `agent-browser --session {S} select @eN "option"` | Select dropdown |
| `agent-browser --session {S} screenshot {path}` | Screenshot |
| `agent-browser --session {S} screenshot --annotate {path}` | Annotated screenshot |
| `agent-browser --session {S} screenshot --full {path}` | Full-page screenshot |
| `agent-browser --session {S} errors` | JS exceptions |
| `agent-browser --session {S} console` | Console messages |
| `agent-browser --session {S} eval 'js expression'` | Run JS |
| `agent-browser --session {S} record start {path.webm}` | Start video |
| `agent-browser --session {S} record stop` | Stop video |
| `agent-browser --session {S} set viewport 375 812` | Mobile viewport |
| `agent-browser --session {S} set viewport 1440 900` | Desktop viewport |
| `agent-browser --session {S} scroll down 500` | Scroll |
| `agent-browser --session {S} close` | End session |
