---
name: parity-audit
description: >
  Run a Procore parity audit across one or more tools. Spawns per-tool sub-agents
  in parallel; each walks the HIGH-priority test cases via Playwright, marks each
  case pass / fail / missing, and writes results to the test_results table. Roll-up
  is viewable at /testing/parity.
argument-hint: <tool-name|all> [priority=HIGH] [projectId=767] [baseUrl=http://localhost:3000]
---

# Parity Audit Orchestrator

**Invocation:**
- `/parity-audit budget` — audit one tool
- `/parity-audit budget,rfis,commitments` — audit multiple
- `/parity-audit all` — audit every suite in `test_suites`
- `/parity-audit budget priority=MEDIUM` — override default HIGH priority
- `/parity-audit budget projectId=767 baseUrl=http://localhost:3000` — explicit target scope

**Output:**
- Results written to `test_results` in Supabase (one run per tool)
- Report visible at `http://localhost:3000/testing/parity`
- Summary message with counts + a link to the dashboard

---

## Status Convention (CRITICAL — follow exactly)

The DB has four statuses: `pass` | `fail` | `skip` | `not_tested`. We encode parity
semantics on top of them using the `notes` field:

| Status | Notes prefix | Meaning |
|--------|--------------|---------|
| `pass` | — | Feature exists and works. Steps completed, expected result matched. |
| `fail` | describe bug | Feature exists but is broken. Fill `severity` (critical/major/minor/cosmetic). |
| `skip` | `MISSING: <reason>` | Feature does not exist in our app. This is a roadmap item, not a bug. |
| `skip` | `BLOCKED: <reason>` | Could not reach the flow (auth, data dependency, unrelated app issue). |
| `not_tested` | — | Left for humans. Only use when the test requires real-world context the agent cannot provide. |

**`MISSING:` prefix is mandatory for "not built yet" parity counting.**  
`BLOCKED:` is strongly recommended so blocked causes are easy to triage.

---

## Orchestrator Steps

### 0. Preflight (mandatory fail-fast)

Before creating runs or launching workers:

- Resolve runtime params:
  - `BASE_URL` default: `http://localhost:3000` (allow override via `baseUrl=...`)
  - `PROJECT_ID` default: `767` (allow override via `projectId=...`)
  - `PRIORITY` default: `HIGH`
- Verify `BASE_URL` is reachable (expect 200/3xx on `/`).
- Verify auth session is valid by loading a protected page at
  `${BASE_URL}/${PROJECT_ID}`. If redirected to login: stop with `BLOCKED: auth-expired`.
- Verify each target suite exists in `test_suites`.
- Verify each suite has `test_cases` seeded for requested priority.
- Abort early with a concrete reason if any preflight check fails.

### 1. Resolve the tool list

- `all` → `SELECT tool_name FROM test_suites ORDER BY display_name`
- comma-separated → split and trim
- single → array of one

Bail out if any tool is not in `test_suites`.

### 2. Create one run per tool

For each tool, `POST ${BASE_URL}/api/testing/runs`:

```json
{
  "suite": "<tool_name>",
  "tester": "parity-audit-agent",
  "environment": "<BASE_URL host>",
  "branch": "<current git branch>",
  "notes": "Automated parity audit",
  "testType": "feature",
  "scenarioDepth": "all"
}
```

Capture `run_id` per tool.

### 3. Dispatch per-tool audit workers in parallel

Launch one worker/sub-agent call per tool in one parallel batch using the runtime's
supported delegation primitive.

**Sub-agent prompt template** (fill in the bracketed values):

> You are auditing the `[TOOL_NAME]` tool against the seeded Procore feature test
> matrix for project `[PROJECT_ID]` (Alleato AI).
>
> **Your target:** Test run `[RUN_ID]`. Walk every test_case where
> `priority = '[PRIORITY]'` and mark the result.
>
> **Auth:** Already logged in via saved browser session. If you hit a login page,
> stop and return `BLOCKED: auth-expired`.
>
> **Base URL:** `[BASE_URL]`. Project scope: `/[projectId]/...` where
> `projectId = [PROJECT_ID]`.
>
> **For each test case:**
> 1. `GET [BASE_URL]/api/testing/runs/[RUN_ID]/results?type=feature` once. Filter to
>    `test_cases.priority = '[PRIORITY]'` in memory. Process each.
> 2. Navigate to `test_cases.start_url` (if set) or the default tool URL.
> 3. Execute `test_cases.steps` using Playwright MCP.
> 4. Compare against `test_cases.expected_result`.
> 5. PATCH `[BASE_URL]/api/testing/runs/[RUN_ID]/results/[RESULT_ID]`:
>    - If expected behavior observed → `{ "status": "pass" }`
>    - If feature exists but misbehaves → `{ "status": "fail", "notes": "<what broke>", "severity": "major" }`
>    - If the UI element / feature does not exist anywhere in the tool →
>      `{ "status": "skip", "notes": "MISSING: <what's absent>" }`
>    - If blocked by auth/data/unrelated bug →
>      `{ "status": "skip", "notes": "BLOCKED: <reason>" }`
> 6. For every `fail`, upload screenshot evidence:
>    `POST [BASE_URL]/api/testing/runs/[RUN_ID]/results/[RESULT_ID]/screenshots`
>    with `{ "dataUrl": "data:image/png;base64,...", "label": "fail-[TEST_NUMBER]" }`.
> 7. Move to next case. Don't retry; one pass per case.
>
> **Rules:**
> - Don't modify production data beyond what a human tester would (create test
>   records with "Parity Test" prefix so cleanup is easy).
> - Take and upload a screenshot on every `fail`; ignore screenshots for `pass` and `skip`.
> - Keep notes under 200 chars. One sentence, actionable.
> - Before declaring MISSING, search the tool's nav, toolbar, row actions, and
>   settings page. Procore often buries features.
>
> **Report back (≤150 words):**
> - pass count / fail count / missing count / blocked count
> - Top 3 missing features (by priority within the run)
> - Any blockers that stopped the audit early

### 4. Wait for all sub-agents, then report

Once all worker calls return, fetch `[BASE_URL]/api/testing/parity?priority=[PRIORITY]`
and summarize for the user:

- Grand totals (working / broken / not-built)
- Per-tool pass rate
- Link to `[BASE_URL]/testing/parity`
- Top 5 "not built" items across all tools, sorted by (priority, tool)

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
- Runtime can execute parallel worker/sub-agent calls and HTTP requests to the testing APIs
