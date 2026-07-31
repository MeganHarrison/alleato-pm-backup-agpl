---
title: Error Patterns
description: Documented recurring mistakes that agents make in the Alleato codebase, with detection methods and solutions.
keywords: ["errors", "mistakes", "anti-patterns", "debugging", "troubleshooting", "common issues"]
---

# Error Patterns

This library documents recurring mistakes that have occurred in the Alleato-Procore project, helping prevent the same issues from happening again.

## Purpose

The error pattern library serves three functions:

1. **Documentation** - Record mistakes that have occurred and their solutions
2. **Prevention** - Auto-inject relevant patterns into agent prompts
3. **Learning** - Build institutional knowledge that survives between sessions

## Critical Severity Patterns

| Pattern | Summary | Triggers |
|---------|---------|----------|
| [NetworkIdle Timeout](#networkidle-timeout) | Use domcontentloaded instead of networkidle | playwright, test, waitForLoadState |
| [Auth Fixture Missing](#auth-fixture-missing) | Import from fixtures for authenticated requests | playwright, auth, fixture, api |
| [Route Param Mismatch](#route-param-mismatch) | Use [projectId] not [id] for routes | route, param, next.js, [id] |
| [Premature Completion](#premature-completion) | Require gate checksums for completion | verification, complete, done |

## High Severity Patterns

| Pattern | Summary | Triggers |
|---------|---------|----------|
| [FK Constraint User](#fk-constraint-user) | Check profile exists before created_by | foreign key, constraint, user, profile |
| [Supabase Types Stale](#supabase-types-stale) | Regenerate types before database work | supabase, types, schema, migration |

---

## NetworkIdle Timeout

**Severity:** CRITICAL
**Category:** Testing
**Triggers:** playwright, test, waitForLoadState, networkidle, timeout, navigation

### The Mistake

Using `waitForLoadState('networkidle')` in Playwright tests causes timeouts because modern web applications have:

- Continuous polling (websockets, real-time updates)
- Background API calls that never fully settle
- Analytics and tracking that keep connections open

```typescript
// WRONG - Will timeout or be flaky
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');  // Hangs here
```text
**Evidence:** 30+ test files in this codebase use `networkidle` and experience random timeouts.

### The Fix

Use `domcontentloaded` instead, which settles when the initial HTML is loaded:

```typescript
// CORRECT - Reliable and fast
await page.goto('/dashboard');
await page.waitForLoadState('domcontentloaded');

// If you need to wait for specific content, wait for that element:
await page.locator('[data-testid="dashboard-loaded"]').waitFor();
```typescript
**For navigation helpers, use:**

```typescript
// frontend/tests/helpers/navigation.ts
export async function safeNavigate(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
}
```javascript
### Detection

Signs this mistake is happening:
1. Tests timeout after 30-120 seconds
2. Tests pass sometimes, fail other times (flaky)
3. Error message includes "waiting for load state 'networkidle'"
4. Tests work locally but fail in CI

### References

- Fixed in: `frontend/tests/e2e/change-events*.spec.ts` (2026-01-10)
- Related: [Auth Fixture Missing](#auth-fixture-missing) (often occurs together)

---

## Auth Fixture Missing

**Severity:** CRITICAL
**Category:** Testing
**Triggers:** playwright, auth, fixture, api, request, 401, unauthorized

<Note variant="warning">
Common issue when adding new E2E tests that make API requests
</Note>

### The Mistake

Creating API requests in Playwright tests without importing the authenticated user fixture:

```typescript
// WRONG - Returns 401 Unauthorized
test('create change event', async ({ page, request }) => {
  const response = await request.post('/api/change-events', {
    data: { title: 'Test' }
  });
  // Error: 401 Unauthorized
});
```

**Why this fails:**

- Tests run in isolated browser context
- No cookies/tokens are set by default
- API routes check authentication and reject

### The Fix

Import `user` fixture from `auth.setup.ts`:

```typescript
// CORRECT - Uses authenticated session
import { test, expect } from '@playwright/test';
import { user } from '../fixtures/auth.setup';

test('create change event', async ({ page, request }) => {
  const response = await request.post('/api/change-events', {
    headers: {
      'Cookie': user.cookies,  // Includes auth token
    },
    data: { title: 'Test' }
  });
  expect(response.status()).toBe(201);
});
```javascript
**Or use the fixture directly:**
```typescript
test.use({ storageState: 'tests/.auth/user.json' });

test('create change event', async ({ page }) => {
  // Page now has auth cookies automatically
  await page.goto('/change-events/new');
});
```markdown
### Detection

Signs this mistake is happening:

1. API requests return 401 Unauthorized
2. Test can navigate to pages but can't POST/PUT/DELETE
3. Error: "Authentication required" or "Invalid session"
4. Works when you manually log in before test

### References

- Fixed in: `frontend/tests/e2e/budget-views.spec.ts` (2026-01-28)
- Auth setup: `frontend/tests/auth.setup.ts`
- Pattern docs: [Playwright Testing Patterns](/patterns/playwright-patterns)

---

## Route Param Mismatch

**Severity:** CRITICAL
**Category:** Routing
**Triggers:** route, param, next.js, [id], dynamic, conflict

### The Mistake

Using generic `[id]` as route parameter name when multiple resources exist:

```text
// WRONG - Causes route conflicts
app/
  projects/[id]/
    budget/[id]/     ❌ Which [id]?
    contracts/[id]/  ❌ Conflict!
```

**Why this fails:**

- Next.js can't distinguish between route params
- Params object has duplicate keys
- Wrong ID gets passed to API calls

**Real incident:** 2026-01-10 - Budget views broken because contract `[id]` conflicted with budget `[id]`

### The Fix

Always use specific, descriptive parameter names:

```text
// CORRECT - No ambiguity
app/
  projects/[projectId]/
    budget/[budgetId]/
    contracts/[contractId]/
    change-events/[eventId]/
```typescript
**In your code:**

```typescript
// Route: /projects/[projectId]/budget/[budgetId]
interface RouteParams {
  params: Promise<{
    projectId: string;
    budgetId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId, budgetId } = await params;
  // Both IDs are correctly scoped
}
```javascript
### Detection

Signs this mistake is happening:
1. Wrong resource loads (contract shows budget data)
2. API calls use incorrect IDs
3. TypeScript errors about duplicate param names
4. Routes work alone but break when combined

### Naming Convention

| Resource | Parameter Name |
|----------|---------------|
| Project | `[projectId]` |
| Budget | `[budgetId]` |
| Contract | `[contractId]` |
| Change Event | `[eventId]` |
| Change Order | `[orderId]` |
| Company | `[companyId]` |
| Person | `[personId]` |
| Task | `[taskId]` |

### References

- Fixed in: `app/(main)/[projectId]/budget/` routes (2026-01-10)
- Convention: `.claude/NAMING-CONVENTIONS.md`

---

## Premature Completion

**Severity:** CRITICAL
**Category:** Workflow
**Triggers:** verification, complete, done, claim, finish

### The Mistake

Claiming a task is complete without running verification gates:

```typescript
// WRONG - No verification
async function implementFeature() {
  await writeCode();
  await writeTests();
  return "Feature complete! ✅";  // Too soon!
}
```

**Why this fails:**

- Code might not compile
- Tests might not pass
- Feature might not work in browser
- Breaking changes might exist

**Real incident:** 2026-01-08 - Budget views feature claimed complete, but views didn't render due to missing column mapping

### The Fix

Always run verification gates before claiming complete:

```typescript
// CORRECT - Gated verification
async function implementFeature() {
  await writeCode();
  await writeTests();

  // Gate 1: Tests must pass
  const testResult = await runTests();
  if (!testResult.passed) {
    throw new Error(`Tests failed: ${testResult.failures}`);
  }

  // Gate 2: Browser verification
  const browserResult = await verifyInBrowser();
  if (!browserResult.passed) {
    throw new Error(`Browser check failed: ${browserResult.issues}`);
  }

  // Gate 3: No breaking changes
  const regressionResult = await checkRegressions();
  if (regressionResult.breaking.length > 0) {
    throw new Error(`Breaking changes: ${regressionResult.breaking}`);
  }

  return {
    complete: true,
    checksum: generateChecksum([testResult, browserResult, regressionResult])
  };
}
```sql
### Verification Checklist

Before claiming any task complete:

- [ ] Code compiles without errors
- [ ] All tests pass (`npm test`)
- [ ] Feature works in browser (real usage test)
- [ ] No console errors in browser
- [ ] Database queries return expected data
- [ ] API endpoints respond correctly
- [ ] UI renders as expected
- [ ] No breaking changes to existing features

### Detection

Signs premature completion is happening:
1. Agent claims done but feature doesn't work
2. Tests pass but browser shows errors
3. Code compiles but runtime errors occur
4. "It should work" without actual verification

### References

- Workflow: `.agents/workflows/feature-implementation.md`
- Gate enforcement: `.agents/tools/enforce-gates.ts`
- Pattern: [Verification Gate Pattern](/patterns/solutions#verification-gate-pattern)

---

## FK Constraint User

**Severity:** HIGH
**Category:** Database
**Triggers:** foreign key, constraint, user, profile, created_by, auth

### The Mistake

Adding foreign keys to `auth.users` or referencing users before they exist:

```sql
-- WRONG - auth.users is not accessible to RLS
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id)  ❌
);
```sql
**Why this fails:**

- `auth.users` table is in protected schema
- RLS policies can't join to auth schema
- Queries fail with permission errors

**Real incident:** 2026-01-27 - Created project memberships with `user_id` references before users were synced

### The Fix

Reference the `people` table (your app's user table):

```sql
-- CORRECT - Reference people table
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  created_by INTEGER REFERENCES people(id),  ✅
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policy can now join properly
CREATE POLICY "documents_select" ON documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM project_directory_memberships pdm
    WHERE pdm.project_id = documents.project_id
    AND pdm.person_id = documents.created_by
  )
);
```javascript
**Profile sync pattern:**
```typescript
// Ensure profile exists before creating records
async function createDocument(data: DocumentCreate) {
  const { data: profile } = await supabase
    .from('people')
    .select('id')
    .eq('auth_user_id', currentUser.id)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  return supabase.from('documents').insert({
    ...data,
    created_by: profile.id,  // Use people.id
  });
}
```

### Detection

Signs this mistake is happening:

1. Error: "permission denied for table auth.users"
2. Error: "foreign key constraint violation"
3. RLS policies can't find user context
4. Queries work for admin, fail for users

### References

- Schema: `supabase/migrations/*_people.sql`
- Auth integration: `lib/auth/getCurrentUser.ts`

---

## Supabase Types Stale

**Severity:** HIGH
**Category:** Database
**Triggers:** supabase, types, schema, migration, column, not exist

### The Mistake

Writing queries against database without regenerating types after schema changes:

```typescript
// Schema was updated but types not regenerated
const { data } = await supabase
  .from('budget_views')
  .select('display_name');  // ❌ Column doesn't exist

// TypeScript doesn't catch error because types are stale!
```sql
**Why this fails:**
- Types are generated from schema snapshot
- Schema changes don't auto-update types
- Code compiles but runtime errors occur

**Real incident:** 2026-01-28 - Budget views queries used old column names after migration renamed them

### The Fix

**Always regenerate types before database work:**

```bash
# Step 1: Regenerate types
npm run db:types

# Step 2: Verify the types file
cat frontend/src/types/database.types.ts | grep -A 10 "budget_views"

# Step 3: Write queries using correct types
const { data } = await supabase
  .from('budget_views')
  .select('name');  // ✅ Correct column
```bash
**Make it automatic:**

```json
// package.json
{
  "scripts": {
    "db:migrate": "supabase db push && npm run db:types",
    "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.types.ts"
  }
}
```markdown
### Detection

Signs types are stale:
1. TypeScript compiles but runtime errors
2. Error: "column 'X' does not exist"
3. Recent migration but types not updated
4. Queries work in SQL editor, fail in code

### Workflow

Every time you change the schema:

1. Write migration
2. Apply migration: `npm run db:migrate`
3. **Regenerate types:** `npm run db:types`
4. Verify types file has changes
5. Update queries to use new types
6. Test queries

### References

- Types generation: `package.json` scripts
- Schema: `supabase/migrations/`
- Type file: `frontend/src/types/database.types.ts`

---

## Pattern File Format

Each pattern file follows this structure:

```markdown
# Pattern: [Name]

**Severity:** CRITICAL | HIGH | MEDIUM | LOW
**Triggers:** [keywords that should trigger this pattern]
**Category:** Testing | Database | Routing | Workflow

---

## The Mistake
[What agents do wrong]

## The Fix
[Exact code/approach to use instead]

## Detection
[How to know if this mistake is happening]

## References
[Links to related files and documentation]
```

## How Patterns Are Used

### For Agents

Before starting any task:

1. Read this index to find relevant patterns
2. Match task keywords against triggers
3. Apply the documented solutions
4. Run verification gates before claiming complete

### Auto-Injection

The injection system matches task prompts against triggers:

```typescript
import patterns from '.agents/patterns/index.json';

function getRelevantPatterns(taskPrompt: string): string[] {
  return patterns.patterns
    .filter(p => p.triggers.some(t =>
      taskPrompt.toLowerCase().includes(t.toLowerCase())
    ))
    .sort((a, b) => {
      const severity = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severity[a.severity] - severity[b.severity];
    })
    .slice(0, patterns.injectionRules.maxPatternsPerPrompt)
    .map(p => fs.readFileSync(`.agents/patterns/${p.file}`, 'utf-8'));
}
```

## Related Documentation

- [Solutions Patterns](/patterns/solutions) - Proven fix patterns
- [Playwright Testing](/patterns/playwright-patterns) - Testing best practices
- [Validated Patterns](/patterns/overview) - Code patterns registry
