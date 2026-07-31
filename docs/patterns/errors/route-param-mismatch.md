---
title: route param mismatch
description: route param mismatch documentation
---

# Pattern: Route Parameter Mismatch

> Migrated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/route-param-naming.md`.

**Severity:** CRITICAL
**Triggers:** `route`, `[projectId]`, `[id]`, `param`, `dynamic`, `api`, `app router`, `next.js`, `page.tsx`, `route.ts`
**Category:** Next.js Routing

---

## The Mistake

Using inconsistent parameter names in Next.js dynamic routes causes the entire application to break:

```bash
# WRONG - Mixed parameter names
frontend/src/app/api/projects/[id]/route.ts          # Uses [id]
frontend/src/app/[projectId]/budget/page.tsx         # Uses [projectId]

Result: Application crashes with routing conflicts
```bash
**Historical incidents:**

1. 2026-01-10: `[id]` vs `[projectId]` conflict broke all project routes
2. 2026-01-10: Duplicate `[contractId]` folders caused build failures
3. 2026-01-10: API route `[id]` conflicted with page route `[projectId]`

---

## The Fix

**ALWAYS use the standard parameter names from this table:**

| Resource | Parameter Name | Example Path |
|----------|---------------|--------------|
| Projects | `[projectId]` | `/[projectId]/budget` |
| Contracts | `[contractId]` | `/[projectId]/contracts/[contractId]` |
| Commitments | `[commitmentId]` | `/[projectId]/commitments/[commitmentId]` |
| Change Events | `[changeEventId]` | `/[projectId]/change-events/[changeEventId]` |
| Change Orders | `[changeOrderId]` | `/[projectId]/change-orders/[changeOrderId]` |
| Invoices | `[invoiceId]` | `/[projectId]/invoices/[invoiceId]` |
| Line Items | `[lineItemId]` | `.../line-items/[lineItemId]` |
| Attachments | `[attachmentId]` | `.../attachments/[attachmentId]` |
| Users | `[userId]` | `/users/[userId]` |
| Companies | `[companyId]` | `/companies/[companyId]` |

**NEVER use generic `[id]` - ALWAYS use the specific resource name.**

---

## Pre-Creation Checklist

Before creating ANY dynamic route folder:

```bash
# 1. Check if the parameter already exists
find frontend/src/app -type d -name "[*]" | head -20

# 2. Verify the standard name from the table above

# 3. Check for existing routes with similar paths
ls -la frontend/src/app/api/projects/

# 4. Use the EXACT same parameter name everywhere
```diff
---

## Detection

Signs this mistake is happening:
1. Next.js build error: "Conflicting app and page file"
2. Application crashes on navigation
3. Dynamic routes return 404
4. Error: "Cannot find parameter X in route"
5. Type errors: `params.id` vs `params.projectId`

---

## Fixing Existing Conflicts

If you find a conflict:

```bash
# 1. Find all instances of the wrong parameter
grep -r "\[id\]" frontend/src/app/ --include="*.ts" --include="*.tsx"

# 2. Rename folders consistently
mv frontend/src/app/api/projects/[id] frontend/src/app/api/projects/[projectId]

# 3. Update all code references
# Change: params.id → params.projectId
# Change: { id } → { projectId }

# 4. Run typecheck to find remaining issues
npm run typecheck --prefix frontend
```

---

## References

- Full rules: `.agents/rules/CRITICAL-NEXTJS-ROUTING-RULES.md`
- Incident log: 3 incidents documented on 2026-01-10
- Verification: Run `find frontend/src/app -type d -name "[*]"` to audit
