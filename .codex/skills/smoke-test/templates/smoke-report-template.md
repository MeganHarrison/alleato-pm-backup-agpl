# Smoke Test Report: {TOOL_NAME}

| Field | Value |
|-------|-------|
| **Date** | {DATE} |
| **Tool** | {TOOL_NAME} |
| **Project** | {PROJECT_ID} |
| **URL** | http://localhost:3000/{PROJECT_ID}/{TOOL_PATH} |
| **Verdict** | PASS / FAIL / PARTIAL |
| **Duration** | {DURATION} |

---

## Summary

| Check | Count | Pass | Fail | Verdict |
|-------|-------|------|------|---------|
| API Endpoints | {N} | {N} | {N} | {VERDICT} |
| Page Loads | {N} | {N} | {N} | {VERDICT} |
| Visual / Design Smoke | {N} | {N} | {N} | {VERDICT} |
| CRUD Tests | {N} | {N} | {N} | {VERDICT} |
| DB Validation | {N} | {N} | {N} | {VERDICT} |
| Negative Path | {N} | {N} | {N} | {VERDICT} |

---

## API Health

| Endpoint | Method | Status | Expected | Verdict |
|----------|--------|--------|----------|---------|

---

## Page Loads

| Page | URL | Loaded | JS Errors | Screenshot | Verdict |
|------|-----|--------|-----------|------------|---------|

---

## Visual / Design Smoke

| Page | Overlap | Truncation | Hidden/Broken Controls | Spacing/Layout | Screenshot | Verdict |
|------|---------|------------|--------------------------|----------------|------------|---------|

---

## CRUD Tests

### Create

**Test:** {test name from matrix}
**Result:** PASS / FAIL
**Screenshot:** ![Create result](screenshots/create-result.png)

**Form Completion Coverage:**

| Field | Type | Filled In UI | Value Entered | Persisted |
|-------|------|--------------|---------------|-----------|

**DB Validation:**

| Field | Value Entered | DB Value | Match |
|-------|--------------|----------|-------|

### Read / Detail

**Result:** PASS / FAIL
**Screenshot:** ![Detail](screenshots/detail.png)

### Edit

**Result:** PASS / FAIL / SKIPPED
**Pre-fill check:** All editable controls show saved values? YES / NO
**Screenshot:** ![Edit pre-fill](screenshots/edit-prefill.png)

### Delete

**Result:** PASS / FAIL / SKIPPED
**Screenshot:** ![Delete result](screenshots/delete-result.png)

---

## Negative Path

**Empty form submit:** PASS / FAIL
**Screenshot:** ![Validation](screenshots/validation.png)

---

## Failures

<!-- Only populated if verdict is FAIL or PARTIAL -->

### FAILURE-001: {Short title}

| Field | Value |
|-------|-------|
| **Phase** | API / Page / CRUD / DB / Negative |
| **Severity** | critical / high / medium |
| **What happened** | {description} |
| **Expected** | {what should happen} |

**Screenshot:** ![Failure](screenshots/failure-001.png)

---

## Test Matrix Coverage

| Matrix Test ID | Name | Executed | Result |
|---------------|------|----------|--------|

---

## Next Steps

- If FAIL: Fix critical issues, then re-run `/smoke-test {TOOL_NAME}`
- If PARTIAL: Review medium-severity items, consider `/feature-audit {TOOL_NAME}` for deeper analysis
- If PASS: Tool is healthy for daily use
