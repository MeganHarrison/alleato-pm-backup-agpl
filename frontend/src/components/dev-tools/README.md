# Enhanced Developer Tools Panel

## Overview

Comprehensive debugging panel built specifically for this project's pain points. Based on incident log analysis showing **490+ minutes** of wasted time across recurring issues.

## Features Implemented

### 🔴 Critical Pain Point #1: Next.js Build Cache (90+ min wasted)

**Problem:** New route files not recognized, causing 404s that take 30+ minutes to debug.

**Solution:**

- One-click `.next` cache clear button
- Shows cache status
- Displays instructions for manual restart
- Badge showing "90+ min saved"

**Location:** Overview tab → "Clear Next.js Cache (.next)" button

---

### 🔴 Critical Pain Point #2: Supabase FK Type Mismatches (90+ min wasted)

**Problem:** Creating FKs with wrong types (UUID instead of INTEGER) causes silent query failures.

**Solution:**

- **FK Type Reference Table**: Shows correct types for all major tables
  - `projects.id` → `project_id INTEGER` (not UUID!)
  - `people.id` → `person_id UUID`
  - `vendors.id` → `vendor_id UUID`
  - `companies.id` → `company_id UUID`
- **Query Testing Pattern**: Shows the exact `node -e` command to test queries before deployment
- **Visual Warning**: Red "CRITICAL" badge

**Location:** Database tab → "FK Type Reference"

**What it prevents:**

```typescript
// ❌ WRONG (causes silent failures)
direct_costs.employee_id UUID → people.id (mismatch: people uses UUID, but employee_id references integer)

// ✅ CORRECT
direct_costs.project_id INTEGER → projects.id (both INTEGER)
```

---

### 🔴 Critical Pain Point #3: Authentication Asks (120+ min wasted)

**Problem:** Claude asking user to manually log in when credentials exist in `.env`.

**Solution:**

- Environment info shows if auth keys are configured
- Health checks validate auth session
- Quick link to Supabase dashboard
- (Credentials themselves are in `.env`, not exposed in UI)

**Location:** Overview tab → Environment section

---

### 🟡 Warning: Route Parameter Conflicts (60+ min wasted)

**Problem:** Using generic `[id]` instead of specific `[projectId]` breaks dev server.

**Solution:**

- One-click route conflict checker
- Runs the `check-route-conflicts.sh` script
- Shows current dynamic routes
- Badge showing "60+ min saved"

**Location:** Overview tab → "Check Route Conflicts" button

---

### 🟡 Warning: CHECK Constraint Case Sensitivity

**Problem:** Using `'draft'` instead of `'Draft'` causes silent insert failures.

**Solution:**

- **CHECK Constraint Values Reference**: Shows exact case-sensitive values for all tables
  - Subcontracts status: `Draft, Sent, Pending, Approved, Executed, Closed, Void`
  - Direct costs status: `Draft, Approved, Rejected, Paid`
  - Change orders status: `draft, pending, approved, rejected, void` (lowercase!)
  - Companies status: `ACTIVE, INACTIVE` (uppercase!)

**Location:** Database tab → "CHECK Constraint Values"

---

## Additional Features

### System Health Checks

- Database connection test
- Auth service validation
- API route ping (if on project page)
- RLS policy check
- All with response time tracking

### Console Error Logger

- Captures all `console.error` and `console.warn` calls
- Shows timestamp and error type
- Red badge on icon when errors exist
- Persists during session

### Quick Actions

- **Regenerate Supabase Types**: One-click `npm run db:types`
- **Clear Local Storage**: Reset all cached state
- **Quick Links**: Supabase dashboard, Claude rules

### Tabs

1. **Overview**: Health checks, quick fixes, environment info
2. **Database**: FK types, CHECK constraints, testing patterns
3. **Errors**: Console error log with filtering
4. **Network**: API call log (ready for future implementation)

---

## API Endpoints Created

### POST `/api/dev-tools/clear-cache`

Deletes `.next` directory to force rebuild.

**Security:** Only works in development mode.

### POST `/api/dev-tools/regenerate-types`

Runs `npx supabase gen types typescript...` command.
Also auto-syncs Dev Tools page-schema FK targets from the regenerated types file.

**Security:** Only works in development mode.

### GET `/api/dev-tools/check-routes`

Runs route conflict checker script or basic validation.

**Security:** Only works in development mode.

---

## Usage

1. **Start dev server**: `npm run dev`
2. **Look for `<>` icon** in header (next to notifications)
3. **Click to open panel**
4. **Badge shows error count** if console errors exist

### When to Use Each Tab

**Overview Tab:**

- Before debugging a 404 → Clear Next.js cache first
- Before creating new routes → Check route conflicts
- When types are out of date → Regenerate types
  - This also refreshes FK targets used by the Page Schema tab

**Database Tab:**

- Before creating a new table with FKs → Check FK type reference
- Before inserting test data → Check CHECK constraint values
- After writing a Supabase query → Copy the test pattern

**Errors Tab:**

- When debugging unexpected behavior → Check recent errors
- When user reports an issue → Export error log

**Network Tab:**

- (Future) Monitor API performance
- (Future) Debug failed requests

---

## Time Savings Calculation

Based on incident log (last updated 2026-02-01):

| Pain Point | Incidents | Time Wasted | Prevention |
|------------|-----------|-------------|------------|
| Next.js cache | 3+ | 90+ min | One-click clear |
| Supabase FK types | 3 | 90+ min | Type reference table |
| Authentication | 10+ | 120+ min | Env validation |
| Route conflicts | 3 | 60+ min | Conflict checker |
| CHECK constraints | 2+ | 30+ min | Values reference |
| **Total** | **21+** | **390+ min** | **All in one panel** |

**Estimated time saved per incident avoided: 15-45 minutes**

---

## Customization

To add new features:

1. **New health check**: Add to `runHealthChecks()` function
2. **New quick action**: Add button to Overview tab
3. **New reference data**: Add to Database tab constants
4. **New API endpoint**: Create in `/api/dev-tools/`

---

## Security

- Panel only renders in `NODE_ENV=development`
- All API endpoints verify development mode
- Sensitive env vars not exposed (only shows if they exist)
- Automatically hidden in production builds

---

## Future Enhancements

Based on pain points not yet addressed:

### TypeScript Errors

- [ ] Show recent compilation errors
- [ ] Link to problematic files
- [ ] Quick typecheck button

### API Monitoring

- [ ] Intercept fetch calls
- [ ] Log all API requests/responses
- [ ] Show failed request details
- [ ] Response time graphs

### Performance

- [ ] Page load time tracking
- [ ] Component render counts
- [ ] Bundle size info

### Schema Inspector

- [ ] Visual table relationship graph
- [ ] Column type browser
- [ ] Migration history viewer

---

## Related Documentation

- Database issues: `docs/patterns/database-issues.md`
- API routing errors: `docs/patterns/api-routing-errors.md`
- Next.js debug protocol: `.claude/rules/NEXTJS-DEBUG-PROTOCOL.md`
- Supabase gate: `.claude/rules/SUPABASE-GATE.md`

---

**Last Updated:** 2026-02-01
**Version:** 1.0.0
**Estimated Impact:** Prevents 390+ minutes of debugging across common incident patterns
