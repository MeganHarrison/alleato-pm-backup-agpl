---
name: parity-audit
description: >
  Run a Procore parity audit across one or more tools. Spawns per-tool sub-agents
  in parallel; each walks the HIGH-priority test cases via Playwright, marks each
  case pass / fail / missing, and writes results to the test_results table. Roll-up
  is viewable at /testing/parity.
argument-hint: <tool-name|all> [priority=HIGH]
---

# Parity Audit Orchestrator

**Invocation:**
- `/parity-audit budget` — audit one tool
- `/parity-audit budget,rfis,commitments` — audit multiple
- `/parity-audit all` — audit every suite in `test_suites`
- `/parity-audit budget priority=MEDIUM` — override default HIGH priority

**Output:**
- Results written to `test_results` in Supabase (one run per tool)
- Report visible at `http://localhost:3000/testing/parity`
- Summary message with counts + a link to the dashboard
- Feature checklist output for each tool:
  - `[x]` when the feature is implemented (`pass` or `fail`)
  - `[ ]` when the feature is not implemented (`skip` with `MISSING:`)
  - Include the test case title and a short status note

---

## Status Convention (CRITICAL — follow exactly)

The DB has four statuses: `pass` | `fail` | `skip` | `not_tested`. We encode parity
semantics on top of them using the `notes` field:

| Status | Notes prefix | Meaning |
|--------|--------------|---------|
| `pass` | — | Feature exists and works. Steps completed, expected result matched. |
| `fail` | describe bug | Feature exists but is broken. Fill `severity` (critical/major/minor/cosmetic). |
| `skip` | `MISSING: <reason>` | Feature does not exist in our app. This is a roadmap item, not a bug. |
| `skip` | `BLOCKED: <reason>` | Could not reach the flow (auth, data dependency, etc). |
| `not_tested` | — | Left for humans. Only use when the test requires real-world context the agent cannot provide. |

**If you do not prefix with `MISSING:` or `BLOCKED:`, the parity report will miscount.**

---

## Orchestrator Steps

### 1. Resolve the tool list

- `all` → `SELECT tool_name FROM test_suites ORDER BY display_name`
- comma-separated → split and trim
- single → array of one

Bail out if any tool is not in `test_suites`.

### 2. Create one run per tool

For each tool, `POST /api/testing/runs`:

```json
{
  "suite": "<tool_name>",
  "tester": "parity-audit-agent",
  "environment": "localhost:3000",
  "branch": "<current git branch>",
  "notes": "Automated parity audit",
  "testType": "feature",
  "scenarioDepth": "all"
}
```

Capture `run_id` per tool.

### 3. Dispatch per-tool audit sub-agents in parallel

Launch one `Agent` call per tool **in a single message** (multiple tool_use blocks).
Use the `general-purpose` subagent type.

**Sub-agent prompt template** (fill in the bracketed values):

> You are auditing the `[TOOL_NAME]` tool against the seeded Procore feature test
> matrix for project 767 (Alleato AI).
>
> **Your target:** Test run `[RUN_ID]`. Walk every test_case where
> `priority = '[PRIORITY]'` and mark the result.
>
> **Auth:** Already logged in via saved browser session. If you hit a login page,
> stop and return `BLOCKED: auth-expired`.
>
> **Base URL:** `http://localhost:3000`. Project scope: `/[projectId]/...` where
> `projectId = 767`.
>
> **For each test case:**
> 1. `GET /api/testing/runs/[RUN_ID]/results?type=feature` once. Filter to
>    `test_cases.priority = '[PRIORITY]'` in memory. Process each.
> 2. Navigate to `test_cases.start_url` (if set) or the default tool URL.
> 3. Execute `test_cases.steps` using Playwright MCP.
> 4. Compare against `test_cases.expected_result`.
> 5. PATCH `/api/testing/runs/[RUN_ID]/results/[RESULT_ID]`:
>    - If expected behavior observed → `{ "status": "pass" }`
>    - If feature exists but misbehaves → `{ "status": "fail", "notes": "<what broke>", "severity": "major" }`
>    - If the UI element / feature does not exist anywhere in the tool →
>      `{ "status": "skip", "notes": "MISSING: <what's absent>" }`
>    - If blocked by auth/data/unrelated bug →
>      `{ "status": "skip", "notes": "BLOCKED: <reason>" }`
> 6. Move to next case. Don't retry; one pass per case.
>
> **Rules:**
> - Don't modify production data beyond what a human tester would (create test
>   records with "Parity Test" prefix so cleanup is easy).
> - Take a screenshot on every `fail`; ignore screenshots for `pass` and `skip`.
> - Keep notes under 200 chars. One sentence, actionable.
> - Before declaring MISSING, search the tool's nav, toolbar, row actions, and
>   settings page. Procore often buries features.
>
> **Report back (2 parts):**
> 1. **Summary (short):**
>    - pass count / fail count / missing count / blocked count
>    - Top 3 missing features (by priority within the run)
>    - Any blockers that stopped the audit early
> 2. **Feature checklist (required, every case):**
>    - Emit one line per processed feature using markdown checkboxes:
>      - Implemented (works): `[x] <test_case_title> — PASS`
>      - Implemented (broken): `[x] <test_case_title> — FAIL: <short reason>`
>      - Not implemented: `[ ] <test_case_title> — MISSING: <short reason>`
>      - Blocked: `[ ] <test_case_title> — BLOCKED: <short reason>`
>    - Include every audited feature at the selected priority, no omissions.

### 4. Wait for all sub-agents, then report

Once all sub-agent `Agent` calls return, fetch `/api/testing/parity?priority=[PRIORITY]`
and summarize for the user:

- Grand totals (working / broken / not-built)
- Per-tool pass rate
- Link to `http://localhost:3000/testing/parity`
- Top 5 "not built" items across all tools, sorted by (priority, tool)
- Per-tool feature checklist that includes every feature expected in the tool:
  - `[x]` for implemented features (`pass` and `fail`)
  - `[ ]` for not implemented features (`skip` with `MISSING:`)
  - `[ ]` for blocked cases (`skip` with `BLOCKED:`), clearly labeled as blocked

---

## When to use this skill

- User asks: "what works in our app vs Procore?"
- User asks: "run the parity audit" / "check feature parity"
- User asks: "what's missing from [tool]?"
- After a release, to regenerate the baseline

## When NOT to use this skill

- User wants to write NEW test scenarios → use `/procore-test-matrix <tool>` instead
- User wants to fix ONE bug → direct edit, not an audit
- User wants unit/integration tests → use `test-automator` agent

---

## Prerequisites

- Dev server running on `localhost:3000` (`npm run dev:frontend`)
- Logged-in browser session (Playwright MCP saves it)
- `test_suites` seeded (already true — 20+ suites exist)
- `test_cases` seeded for the target tool (check `source_doc_count > 0`)
