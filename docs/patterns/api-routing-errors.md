---
title: api routing errors
description: api routing errors documentation
---

# 🛣️ API Routing Error Patterns

## Pattern Index

- [Generic Route Parameter Conflicts](#generic-route-parameter-conflicts)
- [Missing Permission Checks](#missing-permission-checks)
- [Incorrect Parameter Extraction](#incorrect-parameter-extraction)
- [Route Handler Method Mismatches](#route-handler-method-mismatches)
- [CORS and Request Validation Errors](#cors-and-request-validation-errors)

---

## Generic Route Parameter Conflicts

### Classification

- **Category:** API Routing
- **Frequency:** Very Common
- **Severity:** P0

### Symptoms

- Next.js dev server fails to start
- "Conflicting route found" errors
- Routes not matching expected patterns
- Page not found errors for valid URLs
- Development server crash on route registration

### Root Causes

1. Multiple route files using generic `[id]` parameter at same level
2. Route parameter conflicts in nested directory structures
3. Static and dynamic routes with overlapping patterns
4. Catch-all routes (`[...slug]`) conflicting with specific routes

### Standard Solution

#### Diagnosis

```bash
# Check for conflicting route files
find . -name "*[id]*" -type f | head -20
find . -name "*[...]*" -type f | head -10

# Look for route parameter patterns
grep -r "\[.*\]" app/ --include="*.tsx" --include="*.ts" | grep -E "(page|route)" | head -20
```markdown
#### Fix
```bash
# WRONG: Generic parameter names causing conflicts
app/api/projects/[id]/route.ts
app/api/companies/[id]/route.ts
app/api/users/[id]/route.ts

# CORRECT: Specific parameter names
app/api/projects/[projectId]/route.ts
app/api/companies/[companyId]/route.ts
app/api/users/[userId]/route.ts
```javascript
#### Validation

- Next.js dev server starts without route conflicts
- All routes resolve to correct handlers
- No "page not found" errors for expected URLs

### Prevention

- **MANDATORY:** Use specific parameter names: `[projectId]`, `[companyId]`, `[userId]`
- **NEVER** use generic `[id]` parameter names
- Follow consistent naming conventions across all routes
- Review route structure during development

### Examples

- **Classic error:** `/api/[projectId]/[id]` conflicts with `/api/[projectId]/users/[id]`
- **Correct pattern:** `/api/[projectId]/companies/[companyId]` and `/api/[projectId]/users/[userId]`

---

## Missing Permission Checks

### Classification

- **Category:** API Security
- **Frequency:** Common
- **Severity:** P0

### Symptoms

- 500 internal server errors on permission-protected routes
- Unauthorized access to restricted resources
- Users accessing data they shouldn't see
- Security vulnerabilities in API endpoints

### Root Causes

1. API routes created without permission validation
2. Copy-paste from non-protected routes
3. Permission service not imported or used
4. Missing authentication middleware

### Standard Solution

#### Diagnosis

```bash
# Search for API routes without permission checks
grep -r "export async function" app/api/ | \
xargs grep -L "PermissionService\|hasPermission\|requirePermission"
```javascript
#### Fix
```typescript
// WRONG: No permission check
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  // Direct database access without validation
  return await getProjectData(projectId);
}

// CORRECT: Proper permission validation
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check permissions
  const permissionService = new PermissionService(supabase);
  const hasPermission = await permissionService.hasPermission(
    user.id,
    projectId,
    "module_name",
    "read"
  );

  if (!hasPermission) {
    return NextResponse.json(
      { error: "insufficient_permissions" },
      { status: 403 }
    );
  }

  // Proceed with authorized operation
  return await getProjectData(projectId);
}
```

#### Validation

- API returns 401 for unauthenticated requests
- API returns 403 for unauthorized access attempts
- Authorized users can access resources successfully

### Prevention

- **MANDATORY:** Include authentication and permission checks in ALL protected routes
- Use standardized API route templates
- Include permission validation in route creation checklist
- Regular security audit of API endpoints

---

## Incorrect Parameter Extraction

### Classification

- **Category:** API Routing
- **Frequency:** Common
- **Severity:** P2

### Symptoms

- "Cannot read property of undefined" errors
- Parameters coming through as undefined
- Type conversion errors on route parameters
- Inconsistent parameter handling across routes

### Root Causes

1. Forgetting `await params` in Next.js 13+ App Router
2. Incorrect parameter destructuring
3. Type conversion assumptions
4. Case sensitivity in parameter names

### Standard Solution

#### Diagnosis

```typescript
// Check parameter extraction in route handlers
console.log("Raw params:", params);
console.log("Awaited params:", await params);
```javascript
#### Fix
```typescript
// WRONG: Not awaiting params (Next.js 13+)
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = params; // This will be a Promise!
  // ... rest of handler
}

// CORRECT: Properly awaiting params
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { projectId } = await params;
  // ... rest of handler
}

// WRONG: Assuming parameter types
const projectIdNum = projectId; // Might be string

// CORRECT: Proper type conversion with validation
const projectIdNum = parseInt(projectId, 10);
if (isNaN(projectIdNum)) {
  return NextResponse.json(
    { error: "Invalid project ID" },
    { status: 400 }
  );
}
```sql
#### Validation

- Parameters extract correctly without undefined errors
- Type conversions work as expected
- Route handlers receive properly formatted parameters

### Prevention

- **ALWAYS** await params in Next.js App Router
- Validate and convert parameter types explicitly
- Use TypeScript interfaces for route parameters
- Test routes with various parameter values

---

## Route Handler Method Mismatches

### Classification

- **Category:** API Routing
- **Frequency:** Occasional
- **Severity:** P2

### Symptoms

- "Method not allowed" errors (405)
- API calls failing with wrong HTTP methods
- Route handlers not responding to expected methods
- Frontend fetch calls failing unexpectedly

### Root Causes

1. Frontend using wrong HTTP method (GET vs POST)
2. Route handler missing required method exports
3. Method naming inconsistencies
4. Copy-paste errors in route definitions

### Standard Solution

#### Diagnosis

```bash
# Check what methods are exported from route files
grep -r "export async function" app/api/ | \
grep -E "(GET|POST|PUT|PATCH|DELETE)"
```sql
#### Fix
```typescript
// WRONG: Missing method handler
// route.ts only has GET export
export async function GET() { ... }

// Frontend tries to POST
fetch('/api/endpoint', { method: 'POST' }); // Will get 405 error

// CORRECT: Include all needed method handlers
export async function GET(request: NextRequest) { ... }
export async function POST(request: NextRequest) { ... }
export async function PUT(request: NextRequest) { ... }
export async function DELETE(request: NextRequest) { ... }
```

#### Validation

- All expected HTTP methods work correctly
- Frontend API calls succeed with correct methods
- No 405 Method Not Allowed errors

### Prevention

- Define all required HTTP methods in route handlers
- Match frontend method calls with backend exports
- Use consistent method naming (GET, POST, PUT, DELETE)
- Test all methods during development

---

## CORS and Request Validation Errors

### Classification

- **Category:** API Configuration
- **Frequency:** Occasional
- **Severity:** P2

### Symptoms

- CORS policy errors in browser console
- Preflight request failures
- Request body parsing errors
- Content-Type header issues

### Root Causes

1. Missing CORS headers for cross-origin requests
2. Request body not properly parsed
3. Content-Type header mismatches
4. Preflight OPTIONS requests not handled

### Standard Solution

#### Diagnosis

```bash
# Check for CORS-related errors in browser
# Check request/response headers in Network tab
# Look for preflight request failures
```javascript
#### Fix
```typescript
// WRONG: No request body parsing
export async function POST(request: NextRequest) {
  const data = request.body; // Raw stream, not parsed
  // ... rest of handler
}

// CORRECT: Proper request body parsing
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // ... validate and process body
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 }
    );
  }
}

// CORRECT: Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

#### Validation

- No CORS errors in browser console
- Request bodies parse correctly
- All request types (JSON, form data) handled properly

### Prevention

- Include proper request body parsing in all POST/PUT routes
- Add CORS headers when needed for cross-origin requests
- Validate Content-Type headers match expected data
- Test API routes from frontend and external tools

---

## Quick API Debugging Checklist

When API routes fail:

1. **Check route parameter conflicts:**

   ```bash
   find app/api -name "*[*]*" | sort
   ```text
2. **Verify permission checks exist:**

   ```bash
   grep -r "PermissionService" app/api/[route-path]/
   ```javascript
3. **Test parameter extraction:**

   ```typescript
   console.log("Params:", await params);
   ```text
4. **Verify method exports:**

   ```bash
   grep "export async function" app/api/[route-path]/route.ts
   ```

5. **Check request body parsing:**

   ```typescript
   const body = await request.json();
   console.log("Body:", body);
   ```

---

**Last Updated:** 2026-01-31
**Pattern Count:** 5
**Next Review:** Weekly
