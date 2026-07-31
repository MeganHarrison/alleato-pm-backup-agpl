---
description: "Add an API endpoint to an existing entity with service method and hook integration"
argument-hint: "<HTTP method> <entity> <purpose> [--hook] [--no-service]"
---

# /api-endpoint - Add Endpoint to Existing Entity

You are an automated endpoint generator. You DO NOT describe steps -- you EXECUTE them. Every step below is an action you perform using tools.

## Arguments

```bash
$ARGUMENTS
```
Parse the arguments:

- **HTTP method**: GET, POST, PUT, PATCH, DELETE (required)
- **Entity**: The entity name, e.g., "contracts", "ScheduleTask", "companies" (required)
- **Purpose**: What the endpoint does, e.g., "export to CSV", "bulk update status", "get summary stats" (required)
- `--hook` - Also add a function to the existing React hook for this entity
- `--no-service` - Skip service method, put logic directly in route handler

Examples:

```text
/api-endpoint GET contracts export-csv --hook
/api-endpoint POST schedule-tasks bulk-update-status --hook
/api-endpoint GET budget summary-stats
/api-endpoint DELETE commitments archive-completed --hook --no-service
```

## STEP 1: Resolve Entity Names

From the entity argument, derive:

| Variable | Rule | Example (input: "ScheduleTask") |
|----------|------|---------|
| `ENTITY` | PascalCase | `ScheduleTask` |
| `entity` | camelCase | `scheduleTask` |
| `entities` | camelCase plural | `scheduleTasks` |
| `ENTITY_TABLE` | snake_case plural | `schedule_tasks` |
| `entity-kebab` | kebab-case plural | `schedule-tasks` |

If the input is already kebab-case or snake_case, convert accordingly.

## STEP 2: Read Database Types (MANDATORY)

Read `frontend/src/types/database.types.ts` using the Read tool.

Find the table matching `ENTITY_TABLE`. Extract:

- All column names and types
- Which columns are nullable
- Primary key type

If the table does NOT exist: STOP. Tell user to run `/scaffold {Entity}` or `/supabase-migration` first.

## STEP 3: Read Existing Code

Read these files in parallel using the Read tool:

**3a. Existing service (if it exists):**

- `frontend/src/services/{entity}Service.ts`
- Note existing methods, DTO types, and patterns

**3b. Existing hook (if it exists and --hook flag set):**

- `frontend/src/hooks/use-{entities}.ts`
- Note existing functions and return type

**3c. Existing API routes:**

- `frontend/src/app/api/projects/[projectId]/{entities}/route.ts`
- Note which methods already exist (GET, POST, etc.)

If the service file doesn't exist and `--no-service` is not set: create a minimal service file following the scaffold pattern.

## STEP 4: Determine Endpoint Shape

Based on the HTTP method and purpose, determine:

**Route path:**

- Collection action: `/api/projects/[projectId]/{entities}/{action}`
  - Example: `/api/projects/[projectId]/contracts/export`
  - Example: `/api/projects/[projectId]/schedule-tasks/bulk-update`
- Single resource action: `/api/projects/[projectId]/{entities}/[{entityId}]/{action}`
  - Example: `/api/projects/[projectId]/contracts/[contractId]/duplicate`

**Request/Response shape:**

- GET endpoints: query params for filters, JSON response
- POST endpoints: JSON body, JSON response
- PATCH/PUT endpoints: JSON body with partial entity, JSON response
- DELETE endpoints: no body (or JSON body for bulk), 204 or JSON response

## STEP 5: Write Service Method (unless --no-service)

Add a new method to the existing service file at `frontend/src/services/{entity}Service.ts`.

Use the Edit tool to add the method to the class. Follow these patterns:

**Query method (GET):**

```typescript
async {methodName}(
  projectId: number,
  filters?: { /* relevant params */ }
): Promise<{ReturnType}> {
  const { data, error } = await this.supabase
    .from("{ENTITY_TABLE}")
    .select("*")
    .eq("project_id", projectId);
    // ... additional filters

  if (error) throw error;
  return data;
}
```
**Mutation method (POST/PATCH/DELETE):**
```typescript
async {methodName}(
  projectId: number,
  dto: {DtoType},
  userId?: string
): Promise<{ReturnType}> {
  const { data, error } = await this.supabase
    .from("{ENTITY_TABLE}")
    .update(/* or insert/delete */)
    .eq("project_id", projectId);

  if (error) throw error;
  return data;
}
```
If the service file doesn't exist, create it following the scaffold pattern from `.claude/scaffolds/crud-resource/service.ts`.

## STEP 6: Write API Route

Create the route file at the determined path.

**Route file template:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { {ENTITY}Service } from "@/services/{entity}Service";

interface RouteParams {
  params: Promise<{ projectId: string; /* other params */ }>;
}

export async function {METHOD}(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const service = new {ENTITY}Service(supabase);
    // ... call service method

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in {entities}/{action}:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```
**CRITICAL route rules:**
- ALWAYS use `[projectId]` not `[id]`
- ALWAYS `await params` (Next.js 15 async params)
- ALWAYS parse `projectId` to number with `parseInt`
- ALWAYS include auth check for mutation endpoints

## STEP 7: Update Hook (if --hook flag)

Edit the existing hook file at `frontend/src/hooks/use-{entities}.ts`.

Add a new function to the hook following the existing pattern in the file. Typical additions:

**For query endpoints:**
Add a new state + fetch function, or add to existing fetch with a flag.

**For mutation endpoints:**
Add a new callback function:
```typescript
const {actionName} = useCallback(
  async (/* params */): Promise<{ReturnType}> => {
    try {
      const response = await fetch(
        `/api/projects/${projectIdNum}/{entities}/{action}`,
        {
          method: "{METHOD}",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(/* payload */),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to {action}");
      }

      const result = await response.json();
      await fetch{ENTITY}s(); // Refetch list
      return result;
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to {action}")
      );
      return null;
    }
  },
  [projectIdNum, fetch{ENTITY}s]
);
```

Also update the hook's return type interface and return statement to include the new function.

## STEP 8: Verify

**8a. Route conflict check:**

```bash
bash scripts/check-route-conflicts.sh
```
**8b. TypeScript check:**
```bash
npm run typecheck --prefix frontend 2>&1 | head -50
```
Fix any errors before proceeding.

## STEP 9: Report Results

```markdown
## Endpoint Added: {METHOD} /api/projects/[projectId]/{entities}/{action}

### Files Modified
- {Service file path}: Added `{methodName}()` method
- {Route file path}: Created {METHOD} handler
- {Hook file path}: Added `{actionName}()` function (if --hook)

### Endpoint Details
- **Method:** {METHOD}
- **Path:** /api/projects/[projectId]/{entities}/{action}
- **Auth:** Required
- **Request:** {description of expected input}
- **Response:** {description of response shape}

### Verification
- [ ] No route conflicts
- [ ] TypeScript compiles
- [ ] Service method matches database types
```

## CRITICAL RULES

1. **Read database.types.ts first** - Know the actual column names and types before writing queries
2. **Read existing service/hook first** - Match existing patterns, don't introduce new conventions
3. **projectId is always parsed to number** - `parseInt(projectId, 10)` in every route handler
4. **Use [projectId] in route paths** - Never [id]
5. **await params in Next.js 15** - Params are async, must be awaited
6. **Auth check on mutations** - Every POST/PATCH/PUT/DELETE must verify the user
7. **Edit existing files, don't overwrite** - Use Edit tool to add methods, not Write tool to replace files
