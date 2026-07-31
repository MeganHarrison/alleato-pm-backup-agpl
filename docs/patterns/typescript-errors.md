# TypeScript Errors — Known Patterns & Solutions

> Append new entries at the bottom. Each entry must include Context, Error, Root Cause, Fix, and Prevention.

---

## 2026-02-03: Clean Pass (Baseline)

**Context:** Full typecheck run on alleato-procore/frontend
**Command:** `npm run typecheck` (`tsc --noEmit`)
**Result:** 0 errors
**Strict flags enabled:** strict, strictNullChecks, strictFunctionTypes, strictBindCallApply, strictPropertyInitialization, noImplicitThis, noImplicitAny, alwaysStrict, noFallthroughCasesInSwitch, forceConsistentCasingInFileNames
**Notes:** Baseline established. All source files (excluding tests, node_modules) pass strict type checking.

---

### Known Risk Areas (from incident history)

1. **FK type mismatches** — `project_id` must be `number` (INTEGER), not `string` (UUID). Supabase types reflect this. Any new table with `project_id` FK must use INTEGER.
2. **Next.js 15 async params** — `params` is a Promise in App Router. Must `await params` before accessing properties.
3. **Stale database.types.ts** — After schema changes, run `npm run db:types` before writing new DB code. Missing types will cause `TS2339: Property does not exist`.
4. **Import paths with dynamic routes** — If routes are renamed (e.g., `[id]` to `[projectId]`), all import paths referencing the old directory must be updated or TypeScript will report module-not-found errors.
