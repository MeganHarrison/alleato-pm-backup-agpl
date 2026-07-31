---
title: CLAUDE CODE LEARNING SYSTEM
description: CLAUDE CODE LEARNING SYSTEM documentation
---

# 🧠 Claude Code Learning System

## **MANDATORY: Every Bug Must Teach The System**

This document establishes a mandatory process to prevent Claude Code from repeating the same mistakes. Every error, bug, or issue encountered must be logged and systematized to improve future interactions.

---

## 🚨 **CRITICAL RULE**

**Before ANY action, Claude Code MUST:**

1. Check this learning system for similar patterns
2. Validate assumptions against documented failures
3. Apply lessons learned from previous errors
4. Document new patterns discovered

**No exceptions. No shortcuts. Every bug teaches the system.**

---

## 📋 **Mandatory Bug Documentation Process**

### Step 1: Immediate Incident Response

When any error/bug occurs:

```markdown
## Bug Report: [SHORT_TITLE] - [DATE]

### Symptom
What the user experienced (exact error message, behavior)

### Root Cause
Technical explanation of why it happened

### Solution Applied
Exact steps taken to fix it

### Prevention
How to avoid this in the future

### Pattern Classification
Which category this belongs to (see classifications below)
```sql
### Step 2: Update Learning Patterns
Add to the appropriate pattern file:
- `authentication-errors.md`
- `permission-failures.md`
- `database-issues.md`
- `frontend-problems.md`
- `api-routing-errors.md`

### Step 3: Update Pre-Action Checklist
If this could have been prevented by validation, add to checklist.

---

## 🔍 **Pre-Action Validation Checklist**

**Claude Code MUST validate these BEFORE taking action:**

### Database Operations
- [ ] Read database types from `database.types.ts` - NEVER assume schema
- [ ] Verify table names exist in types file
- [ ] Check foreign key relationships and types match
- [ ] Confirm column names match exactly (case sensitive)

### Permission System
- [ ] Check if user has `users_auth` record linking to person
- [ ] Verify person has project membership with active status
- [ ] Confirm permission template grants required access level
- [ ] Test permission query before assuming access

### API Development
- [ ] Use specific route parameter names (`[projectId]` not `[id]`)
- [ ] Check existing API route structure before creating new ones
- [ ] Validate request/response types against database schema
- [ ] Test API endpoint manually before claiming it works

### Frontend Components
- [ ] Check existing component patterns before creating new ones
- [ ] Verify prop types match backend API responses
- [ ] Test responsive design on mobile viewports
- [ ] Validate accessibility requirements

### Authentication Flow
- [ ] Verify auth user exists in Supabase Auth
- [ ] Check person record exists with matching identifier
- [ ] Confirm users_auth link exists between auth and person
- [ ] Test full authentication flow end-to-end

---

## 🏗️ **Common Error Patterns & Solutions**

### Authentication Patterns

#### Pattern: Missing users_auth Link
**Symptoms:** "Permission denied" for authenticated admin users
**Root Cause:** Auth user exists, person exists, but no link in users_auth table
**Solution:** Create missing link with `INSERT INTO users_auth (auth_user_id, person_id)`
**Prevention:** Validate users_auth exists in all permission checks

#### Pattern: Person Type Mismatch
**Symptoms:** User can't log in despite invite
**Root Cause:** person_type='contact' instead of 'user'
**Solution:** Update person_type to 'user' for loginable accounts
**Prevention:** Check person_type during invite flow

### Database Patterns

#### Pattern: Foreign Key Type Mismatch
**Symptoms:** Queries return empty results silently
**Root Cause:** FK column type doesn't match PK type (UUID vs INTEGER)
**Solution:** Create migration to fix column types
**Prevention:** Always check database.types.ts before creating tables

#### Pattern: Case Sensitivity Issues
**Symptoms:** "column does not exist" errors
**Root Cause:** JavaScript camelCase vs SQL snake_case mismatch
**Solution:** Use exact column names from database schema
**Prevention:** Copy column names from types file, don't type manually

### API Routing Patterns

#### Pattern: Generic Route Parameter Conflicts
**Symptoms:** Next.js dev server fails to start, routing conflicts
**Root Cause:** Using generic `[id]` parameter in multiple route levels
**Solution:** Use specific names like `[projectId]`, `[companyId]`
**Prevention:** Follow route naming conventions strictly

#### Pattern: Missing Permission Checks
**Symptoms:** 500 errors or unauthorized access
**Root Cause:** API routes missing PermissionService validation
**Solution:** Add permission check at start of every protected route
**Prevention:** Use standardized API route template with built-in checks

### Frontend Patterns

#### Pattern: Server/Client Component Boundary Issues
**Symptoms:** Hydration mismatches, "window is not defined"
**Root Cause:** Server components trying to use client-side APIs
**Solution:** Add "use client" directive or move logic to client component
**Prevention:** Understand Next.js 13+ component model before development

### Permission System Patterns

#### Pattern: Template Rules Not Loaded
**Symptoms:** Permission checks fail despite correct template assignment
**Root Cause:** permission_template_id is null or invalid
**Solution:** Ensure all memberships have valid permission_template_id
**Prevention:** Add database constraints and validation

---

## 🔧 **Debugging Toolkit**

### Quick Diagnosis Scripts

Create these as reusable tools for common debugging:

```bash
# Check auth user to person mapping
./debug-auth-link.sh <email>

# Validate permission system for user/project
./debug-permissions.sh <user_id> <project_id>

# Check database FK consistency
./debug-fk-types.sh <table_name>

# Test API endpoint with real auth
./debug-api.sh <endpoint> <method> <auth_token>
```sql
### Common Queries

```sql
-- Find orphaned auth users (no person link)
SELECT u.id, u.email
FROM auth.users u
LEFT JOIN users_auth ua ON u.id = ua.auth_user_id
WHERE ua.auth_user_id IS NULL;

-- Find people without auth (contacts vs broken users)
SELECT p.id, p.first_name, p.last_name, p.person_type
FROM people p
LEFT JOIN users_auth ua ON p.id = ua.person_id
WHERE ua.person_id IS NULL AND p.person_type = 'user';

-- Check permission template coverage
SELECT pdm.id, pdm.permission_template_id, p.first_name, p.last_name
FROM project_directory_memberships pdm
JOIN people p ON p.id = pdm.person_id
WHERE pdm.permission_template_id IS NULL;
```sql
---

## 📊 **Error Classification System**

### Severity Levels

**P0 - Critical System Failures**
- Authentication completely broken
- Database corruption/data loss
- Security vulnerabilities
- Complete feature breakdown

**P1 - Major Functional Issues**
- Users can't complete core workflows
- Permission system failures
- Data inconsistency issues
- API endpoints returning 500 errors

**P2 - Minor Functional Issues**
- UI glitches that don't block functionality
- Non-critical features not working
- Performance degradation
- Accessibility issues

**P3 - Cosmetic Issues**
- Visual inconsistencies
- Minor text/label errors
- Non-functional UI elements
- Documentation gaps

### Error Categories

**Authentication & Authorization**
- Login/logout flows
- Permission checks
- User session management
- Role-based access control

**Database & Schema**
- Foreign key relationships
- Data type mismatches
- Query failures
- Migration issues

**API & Backend**
- Route handling
- Request/response validation
- Error handling
- Service integration

**Frontend & UI**
- Component rendering
- State management
- User interactions
- Responsive design

**Integration & External Services**
- Third-party API failures
- Configuration issues
- Environment problems
- Deployment errors

---

## 🎯 **Success Metrics**

Track these to measure learning system effectiveness:

### Error Reduction Metrics
- **Repeat Error Rate:** % of errors that are repeats of documented patterns
- **Resolution Time:** Time from error report to fix implementation
- **Prevention Success:** % of potential errors caught by pre-action validation

### Pattern Recognition Metrics
- **Documentation Coverage:** % of error types with documented patterns
- **Pattern Application:** % of new issues that match existing patterns
- **Validation Effectiveness:** % of errors prevented by checklist usage

### Learning System Adoption
- **Documentation Quality:** Completeness and accuracy of bug reports
- **Process Compliance:** % of incidents following mandatory documentation process
- **Pattern Updates:** Frequency of learning system updates and improvements

---

## 📝 **Templates for Common Scenarios**

### Bug Report Template

```markdown
# Bug Report: [Title] - [YYYY-MM-DD]

## Incident Summary
- **Reporter:** [Name]
- **Severity:** [P0/P1/P2/P3]
- **Category:** [Auth/Database/API/Frontend/Integration]
- **Environment:** [Development/Production]

## Symptom Description
What the user experienced:
- Exact error message:
- Steps to reproduce:
- Expected behavior:
- Actual behavior:

## Root Cause Analysis
Technical investigation findings:
- Primary cause:
- Contributing factors:
- System components involved:

## Solution Applied
Exact steps taken to resolve:
1.
2.
3.

## Prevention Measures
How to avoid this in the future:
- Code changes:
- Process improvements:
- Validation additions:

## Pattern Classification
- [ ] New pattern requiring documentation
- [ ] Variant of existing pattern: [link to pattern]
- [ ] Known issue with documented solution

## Follow-up Actions
- [ ] Update pre-action checklist
- [ ] Create/update debugging script
- [ ] Add validation to codebase
- [ ] Update documentation
```

### Pattern Documentation Template

```markdown
# Pattern: [Pattern Name]

## Classification
- **Category:** [Auth/Database/API/Frontend/Integration]
- **Frequency:** [Common/Occasional/Rare]
- **Severity:** [P0/P1/P2/P3]

## Identification
**Symptoms that indicate this pattern:**
-
-
-

## Root Causes
**Common underlying causes:**
1.
2.
3.

## Standard Solution
**Step-by-step resolution process:**
1. **Diagnosis:**
2. **Fix:**
3. **Validation:**

## Prevention
**How to avoid this pattern:**
- **Code practices:**
- **Validation checks:**
- **Process changes:**

## Examples
**Recent incidents following this pattern:**
- [Date]: [Brief description] - [Link to bug report]
- [Date]: [Brief description] - [Link to bug report]

## Related Patterns
- [Related Pattern 1]: [Relationship description]
- [Related Pattern 2]: [Relationship description]
```

---

## 🔄 **Learning System Maintenance**

### Weekly Reviews

Every week, review:

- New patterns identified
- Pattern documentation accuracy
- Pre-action checklist effectiveness
- Success metrics trends

### Monthly Improvements

Every month, update:

- Debugging toolkit based on common issues
- Pattern classifications for emerging trends
- Validation rules for newly discovered failure modes
- Success metrics to track learning effectiveness

### Quarterly Audits

Every quarter, assess:

- Overall error reduction trends
- Learning system adoption across team
- Pattern documentation coverage gaps
- Process effectiveness and improvements needed

---

## 🛡️ **Quality Gates**

### Before Any Code Change

- [ ] Checked learning system for similar patterns
- [ ] Completed pre-action validation checklist
- [ ] Reviewed related bug reports and solutions
- [ ] Identified potential failure modes and mitigations

### After Any Error/Bug

- [ ] Created comprehensive bug report
- [ ] Updated relevant pattern documentation
- [ ] Enhanced pre-action validation if applicable
- [ ] Verified solution prevents recurrence

### Before Claiming Task Complete

- [ ] Tested functionality with real data/users
- [ ] Validated against known error patterns
- [ ] Confirmed no regression of previous fixes
- [ ] Updated documentation as needed

---

**Remember: Every bug is a learning opportunity. Every pattern documented saves future time and frustration. The goal is continuous improvement and error elimination through systematic learning.**

**Last Updated:** 2026-01-31
**Next Review:** Weekly
**Owner:** Development Team
