---
name: smoke-test
description: >
  Fast smoke test for any Alleato tool. Hits every API endpoint, loads every page,
  runs HIGH-priority tests from the existing test matrix, and validates the database.
  Produces a pass/fail report in ~5-10 minutes. Use when: "smoke test [tool]",
  "quick test [tool]", "check if [tool] works", "test [tool] endpoints",
  "is [tool] broken", or any request for a fast sanity check of a tool's functionality.
argument-hint: <tool-name>
---

# Smoke Test

Fast confidence check for any Alleato tool. Answers: "Does it work? Anything broken?"

**Invocation:** `/smoke-test <tool-name>`

**Example:** `/smoke-test drawings`

**Time:** ~5-10 minutes

**Output:** `smoke-test-output/<tool>/report.md` with pass/fail table and failure screenshots

---

## What This Does (and Doesn't)

| Does | Doesn't |
|------|---------|
| Hit every API endpoint, check status codes | Deep Procore compliance comparison |
| Load every page, check for JS errors | Usability recommendations |
| Run HIGH-priority tests from the test matrix | Fix bugs (report only) |
| Validate DB records after create/update | Full field-by-field FK audit |
| Take screenshots of failures | Record repro videos |

For deeper testing, use `/feature-audit <tool>`.

---

## Phase 1: Context Assembly (~30 seconds)

All context is auto-discovered from conventions. No research sub-agents needed.

### 1.1 Resolve tool paths

```
Tool name: <tool-name>
Test matrix: docs/testing/<tool-name>-test-matrix.md
Scenarios: docs/testing/<tool-name>-scenarios.md
Pages: frontend/src/app/(main)/[projectId]/<tool-name>/
API routes: frontend/src/app/api/projects/[projectId]/<tool-name>/
Hooks: frontend/src/hooks/use-<tool-name>*.ts
Types: frontend/src/types/<tool-name>.types.ts
```

### 1.2 Read the test matrix

```bash
cat docs/testing/<tool-name>-test-matrix.md
```

Extract every row where Priority is HIGH (or where no priority is specified — assume HIGH).
These are your test cases.

### 1.3 Inventory API routes

```bash
find frontend/src/app/api/projects/\[projectId\]/<tool-name>/ -name "route.ts" -type f
```

For each route file, extract the HTTP methods exported (GET, POST, PATCH, PUT, DELETE).

### 1.4 Inventory pages

```bash
find frontend/src/app/\(main\)/\[projectId\]/<tool-name>/ -name "page.tsx" -type f
```

### 1.5 Get project ID and auth

```bash
# Project ID for testing (from MEMORY.md)
PROJECT_ID=767

# Auth credentials
source .env 2>/dev/null || export $(grep -E '^(TEST_USER_1|TEST_PASSWORD_1)=' .env | xargs)
```

### Output

Build an internal checklist (do not write to file yet):

```
API endpoints: [list of method + path]
Pages: [list of page paths]
HIGH-priority tests: [list of test IDs and names from matrix]
```

---

## Phase 2: Setup (~30 seconds)

```bash
mkdir -p smoke-test-output/<tool-name>/screenshots

# Enforce any deterministic smoke fixtures before the run starts.
# This must fail loudly if a required fixture cannot be prepared.
npm run smoke:fixtures -- <tool-name>

# Check dev server
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
if [ "$STATUS" = "000" ]; then
  echo "Dev server not running — starting..."
  cd frontend && npm run dev > /tmp/smoke-dev.log 2>&1 &
  sleep 12
fi

# Start browser session
agent-browser --session smoke-<tool> open http://localhost:3000/$PROJECT_ID/<tool-name>
agent-browser --session smoke-<tool> wait --load networkidle
```

### Authenticate if redirected

```bash
CURRENT_URL=$(agent-browser --session smoke-<tool> get url)
if [[ "$CURRENT_URL" == *"auth"* || "$CURRENT_URL" == *"login"* ]]; then
  agent-browser --session smoke-<tool> snapshot -i
  agent-browser --session smoke-<tool> fill @<email> "$TEST_USER_1"
  agent-browser --session smoke-<tool> fill @<password> "$TEST_PASSWORD_1"
  agent-browser --session smoke-<tool> click @<submit>
  agent-browser --session smoke-<tool> wait --load networkidle
fi
```

---

## Phase 3: API Health Check (~1-2 minutes)

For every API endpoint discovered in Phase 1:

```bash
# Get auth cookie from the browser session
COOKIE=$(agent-browser --session smoke-<tool> eval 'document.cookie' 2>/dev/null)

# Hit each endpoint
curl -s -o /dev/null -w "%{http_code}" \
  -H "Cookie: $COOKIE" \
  "http://localhost:3000/api/projects/$PROJECT_ID/<tool-name>"
```

**Expected results:**
- GET (list): 200
- GET (single): 200 (if records exist) or 404 (empty — note but not failure)
- POST: Skip (tested in Phase 5)
- PATCH/PUT: Skip (tested in Phase 5)
- DELETE: Skip (tested in Phase 5)

**Record results:**

| Endpoint | Method | Status | Expected | Verdict |
|----------|--------|--------|----------|---------|
| `/api/projects/767/<tool>` | GET | 200 | 200 | PASS |

---

## Phase 4: Page Load Check (~1-2 minutes)

For every page discovered in Phase 1:

```bash
agent-browser --session smoke-<tool> open http://localhost:3000/$PROJECT_ID/<tool-name>/<subpath>
agent-browser --session smoke-<tool> wait --load networkidle
agent-browser --session smoke-<tool> errors
agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/<page-name>.png
```

**Check for each page:**
- Page loads (no blank screen, no 404)
- No uncaught JS errors in console
- Primary content is visible (table, form, viewer, etc.)

If errors found, take an annotated screenshot:

```bash
agent-browser --session smoke-<tool> screenshot --annotate smoke-test-output/<tool-name>/screenshots/<page-name>-error.png
```

**Record results:**

| Page | URL | Loaded | JS Errors | Verdict |
|------|-----|--------|-----------|---------|
| List | /767/drawings | Yes | None | PASS |
| Viewer | /767/drawings/viewer/xxx | Yes | None | PASS |

---

## Phase 5: Happy-Path CRUD (~3-5 minutes)

Execute the HIGH-priority CRUD tests from the test matrix. Use `fill` everywhere (fast).
Do NOT record video — this is a smoke test, not a repro session.

### 5.1 Create

Follow the create test from the matrix (typically test 1.1.1 or similar).

```bash
# Navigate to create form / upload dialog
agent-browser --session smoke-<tool> snapshot -i

# Fill ALL required fields with realistic test data
agent-browser --session smoke-<tool> fill @eN "test value"
# ... fill every required field

# Submit
agent-browser --session smoke-<tool> click @eN  # Submit button
agent-browser --session smoke-<tool> wait --load networkidle
sleep 1

# Screenshot the result
agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/create-result.png

# Check for errors
agent-browser --session smoke-<tool> errors
```

### 5.2 Validate DB

After create, verify the record exists with all fields:

```bash
# Use the API to verify (or curl the endpoint)
curl -s -H "Cookie: $COOKIE" \
  "http://localhost:3000/api/projects/$PROJECT_ID/<tool-name>?sort=created_at&order=desc&limit=1" | jq .
```

Check:
- Record exists
- All required fields have values (not null)
- Values match what was entered in the form

### 5.3 Read / Detail

Navigate to the created record's detail page:

```bash
agent-browser --session smoke-<tool> open http://localhost:3000/$PROJECT_ID/<tool-name>/<id>
agent-browser --session smoke-<tool> wait --load networkidle
agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/detail.png
agent-browser --session smoke-<tool> errors
```

Check: detail page loads with correct data visible.

### 5.4 Edit (if the test matrix has edit tests)

```bash
agent-browser --session smoke-<tool> snapshot -i
# Click Edit
agent-browser --session smoke-<tool> click @eN
agent-browser --session smoke-<tool> wait --load networkidle
agent-browser --session smoke-<tool> snapshot -i

# Verify pre-fill: dropdowns show saved values, not "Select..."
agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/edit-prefill.png

# Change one field
agent-browser --session smoke-<tool> fill @eN "updated value"
agent-browser --session smoke-<tool> click @eN  # Save
agent-browser --session smoke-<tool> wait --load networkidle
sleep 1

agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/edit-result.png
```

### 5.5 Delete (if the test matrix has delete tests)

```bash
# Find the row action menu for the test record
agent-browser --session smoke-<tool> snapshot -i
agent-browser --session smoke-<tool> click @eN  # Three-dot menu
agent-browser --session smoke-<tool> snapshot -i
agent-browser --session smoke-<tool> click @eN  # Delete option
agent-browser --session smoke-<tool> wait --load networkidle

# Confirm deletion dialog if present
agent-browser --session smoke-<tool> snapshot -i
agent-browser --session smoke-<tool> click @eN  # Confirm
agent-browser --session smoke-<tool> wait --load networkidle
sleep 1

agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/delete-result.png
```

### 5.6 Negative Path (required field validation)

Submit the create form with required fields empty:

```bash
# Open create form
agent-browser --session smoke-<tool> snapshot -i
# Click submit without filling anything
agent-browser --session smoke-<tool> click @eN  # Submit
sleep 1
agent-browser --session smoke-<tool> screenshot smoke-test-output/<tool-name>/screenshots/validation.png
```

Check: validation errors appear inline. No crash. No silent save.

---

## Phase 6: Write Report (~30 seconds)

Copy the template and fill it in:

```bash
cp {SKILL_DIR}/templates/smoke-report-template.md smoke-test-output/<tool-name>/report.md
```

Fill in all results. Read every screenshot taken with the Read tool before finalizing.

**Verdict rules:**
- **PASS:** All API endpoints healthy, all pages load, CRUD works, DB validates
- **FAIL:** Any API returns 5xx, any page crashes, create/edit silently drops data, or delete doesn't work
- **PARTIAL:** Minor issues found (e.g., optional field not saving, cosmetic JS warning) but core flows work

---

## Phase 7: Cleanup

```bash
agent-browser --session smoke-<tool> close
```

Present the report summary to the user:
- Overall verdict (PASS / FAIL / PARTIAL)
- Count of endpoints checked, pages loaded, tests run
- Any failures with their screenshots
- If FAIL: which specific tests failed and why

---

## Speed Rules

- **Use `fill` everywhere.** Never `type`.
- **No video recording.** Screenshots only for failures.
- **No research sub-agents.** Read the test matrix directly.
- **No Procore comparison.** That's `/feature-audit` territory.
- **No sleep between fill calls.** Only `sleep 1` after submit/navigation.
- **Batch agent-browser commands** with `&&` when independent.

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
| `agent-browser --session {S} errors` | JS exceptions |
| `agent-browser --session {S} console` | Console messages |
| `agent-browser --session {S} eval 'js expression'` | Run JS |
| `agent-browser --session {S} close` | End session |
