# Feature Audit Report: {TOOL_NAME}

| Field | Value |
|-------|-------|
| **Date** | {DATE} |
| **Tool** | {TOOL_NAME} |
| **Project** | {PROJECT_ID} |
| **URL** | http://localhost:3000/{PROJECT_ID}/{TOOL_PATH} |
| **Overall Verdict** | PASS / FAIL / PARTIAL |
| **Duration** | {DURATION} |

---

## Executive Summary

{2-3 sentences: overall health, biggest concern, biggest opportunity}

---

## Scorecard

| Category | Score | Details |
|----------|-------|---------|
| **Functional Tests** | {N}/{total} pass | {breakdown} |
| **DB Validation** | {N}/{total} fields verified | {any dropped fields?} |
| **Edit Pre-fill (Gate 11)** | {N}/{total} dropdowns correct | {any FK mismatches?} |
| **Negative Paths** | {N}/{total} pass | {validation working?} |
| **Status Transitions** | {N}/{total} pass | {or N/A if no workflow} |
| **Procore Compliance** | {N} match / {N} gap / {N} mismatch | |
| **Design System** | {N} violations | |
| **Issues Found** | {critical}C / {high}H / {medium}M / {low}L | |
| **Issues Fixed** | {N} fixed during audit | |

---

## 1. Functional Test Results

### Test Matrix Execution

| # | Test Name | Priority | Result | Notes |
|---|-----------|----------|--------|-------|
| 1.1.1 | {name from matrix} | HIGH | PASS/FAIL | |

### Form Completion Coverage

| Form / Flow | Create Saved | Edit Saved | Reload / Reopen Verified | DB Verified | Negative Path Tested | Artifact Paths |
|------------|--------------|-----------|--------------------------|------------|----------------------|----------------|
| {create/edit form name} | Yes/No | Yes/No | Yes/No | Yes/No | Yes/No | screenshots/{name}.png, videos/{name}.webm |

### DB Validation

| Field | Value Entered | DB Value | Match |
|-------|--------------|----------|-------|

### Edit Pre-fill Check

| Dropdown | Expected Value | Displayed Value | Verdict |
|----------|---------------|----------------|---------|

### Negative Path Results

| Test | Expected | Actual | Verdict |
|------|----------|--------|---------|

---

## 2. Procore Compliance

### Field Comparison

| Field | Procore | Ours | Verdict |
|-------|---------|------|---------|
| {field name} | {Procore behavior} | {our behavior} | Match / Gap / Custom / Mismatch |

### Status & Workflow Comparison

| Status | Procore | Ours | Verdict |
|--------|---------|------|---------|
| {status} | {Procore behavior} | {our behavior} | Match / Gap |

### Feature Comparison

| Feature | Procore Has | We Have | Verdict |
|---------|-----------|---------|---------|
| {feature} | Yes/No | Yes/No | Match / Gap / Custom |

### Compliance Summary

- **Matches:** {N} behaviors align with Procore
- **Gaps:** {N} Procore features we're missing
- **Custom:** {N} features we added beyond Procore
- **Mismatches:** {N} features that work differently (review needed)

---

## 3. Usability & Architecture Findings

### Performance

| Observation | Severity | Details |
|-------------|----------|---------|
| {finding} | High/Medium/Low | {specifics} |

### Missing Capabilities

| Capability | Procore Has It | Industry Standard | Impact |
|-----------|---------------|-------------------|--------|
| {capability} | Yes/No | Yes/No | High/Medium/Low |

### UX Issues

| # | Issue | Severity | Screenshot |
|---|-------|----------|------------|
| UX-001 | {description} | High/Medium/Low | ![](screenshots/ux-001.png) |

### Code Quality

| File | Lines | Issue | Recommendation |
|------|-------|-------|---------------|
| {path} | {N} | {issue} | {recommendation} |

---

## 4. Issues Found

<!-- Copy this block for each issue -->

### ISSUE-001: {Title} — {CRITICAL/HIGH/MEDIUM/LOW} — {FIXED/OPEN}

| Field | Value |
|-------|-------|
| **Category** | Functional / Data / UX / Performance / Design System |
| **Test** | {test matrix ID if applicable} |
| **URL** | {page URL} |

**Expected:** {what should happen}
**Actual:** {what happened}
**Impact:** {user impact}

**Screenshot:** ![Issue](screenshots/issue-001.png)
**Video:** {path or N/A}

**Root cause:** {if identified}
**Fix applied:** {file:line — if fixed}

---

## 5. Improvement Recommendations

### Priority Matrix

| Priority | Count |
|----------|-------|
| Do First (High Impact + Low Effort) | {N} |
| Quick Win (Medium Impact + Low Effort) | {N} |
| Plan Next (High Impact + High Effort) | {N} |
| Backlog (Medium Impact + High Effort) | {N} |

<!-- Copy this block for each recommendation -->

### REC-001: {Title}

| Field | Value |
|-------|-------|
| **Category** | Performance / Missing Capability / UX / Architecture / Procore Gap |
| **Impact** | High / Medium / Low |
| **Effort** | S (< 1hr) / M (1-4hr) / L (half day) / XL (1+ day) |
| **Priority** | Do First / Quick Win / Plan Next / Backlog |

**Current state:** {what exists now}
**Recommended:** {what should change}
**Why:** {user impact or technical benefit}
**How:** {specific files, libraries, patterns}

---

## 6. Screenshots & Evidence

| # | Description | Path |
|---|-------------|------|
| 1 | {description} | screenshots/{name}.png |

### Required Artifact Checklist

- [ ] Empty/start state screenshot for each form flow
- [ ] Pre-submit screenshot for each form flow
- [ ] Post-submit or resulting-state screenshot for each form flow
- [ ] DB validation output for each create/update
- [ ] Edit prefill screenshot after reload
- [ ] Failure screenshot for each failed case
- [ ] Failure video for each failed case
- [ ] Create, edit, reload, DB verify, and negative path completed in order for each audited form flow

---

## 7. Next Steps

### Immediate (fix now)
- {Critical/High issues that are still OPEN}

### Short-term (this sprint)
- {Do First and Quick Win recommendations}

### Medium-term (next sprint)
- {Plan Next recommendations}

### Long-term (backlog)
- {Backlog recommendations and Procore gaps to evaluate}

---

## Sources Used

| Source | Path |
|--------|------|
| Test Matrix | docs/testing/{tool}-test-matrix.md |
| Scenarios | docs/testing/{tool}-scenarios.md |
| PRP | _bmad-output/planning-artifacts/{tool}/prp-{tool}.md |
| Manifest | .claude/procore-manifests/{tool}/manifest.json |
| Procore Docs | {RAG query results} |
