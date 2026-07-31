# Form Testing Errors

**Test Run ID:** [timestamp]
**Date:** [ISO 8601 timestamp]
**Scope:** [all | page | modal | inline | auth | form-name]
**Total Errors:** X (Blockers: X, Major: X, Minor: X)

---

## Summary

| Severity | Count | Forms Affected |
|----------|-------|----------------|
| BLOCKER  | X     | [list]         |
| MAJOR    | X     | [list]         |
| MINOR    | X     | [list]         |

---

## Errors by Form

### [Form Name 1]

#### Error 1: [Error Title]

- **Severity**: BLOCKER | MAJOR | MINOR
- **Form**: [form name]
- **Form Type**: Page | Modal | Inline | Auth
- **Field**: [field name or "N/A"]
- **Error**: [Clear, concise description of the issue]
- **Expected**: [What should happen according to spec or UX best practices]
- **Actual**: [What actually happens in the browser]
- **Reproduction Steps**:
  1. [Navigate to form or trigger modal]
  2. [Specific action that triggers error]
  3. [Result observed]
- **Screenshot**: [relative path to screenshot file]
- **Timestamp**: [ISO 8601 format]
- **Test Phase**: [Load | Initial State | Validation | Fill | Submission | Error Handling | Accessibility | Modal Behaviors]

---

### [Form Name 2]

[Repeat error format for each error in each form]

---

## Errors by Severity

### BLOCKER (X)

[List of all blocker errors with form names and brief descriptions]

### MAJOR (X)

[List of all major errors with form names and brief descriptions]

### MINOR (X)

[List of all minor errors with form names and brief descriptions]

---

## Recommendations

Based on the errors found, we recommend:

1. [Priority 1 fix]
2. [Priority 2 fix]
3. [Priority 3 fix]

---

## Forms Affected

| Form Name | Type | Blockers | Major | Minor | Total |
|-----------|------|----------|-------|-------|-------|
| [name]    | Page | 0        | 2     | 1     | 3     |
| ...       | ...  | ...      | ...   | ...   | ...   |

---

## Next Steps

1. Review all BLOCKER errors immediately
2. Create tickets for MAJOR errors
3. Schedule fixes for MINOR errors
4. Retest affected forms after fixes

---

**Report Generated:** [timestamp]
**Test Report:** [link to main test report]
