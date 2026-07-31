---
title: PATTERNS
description: PATTERNS documentation
---

# Validated Patterns Registry

> Deprecated on 2026-04-14.
> Canonical replacement: `docs/ops/patterns/index.md`.
> Reason: duplicate of `docs/patterns/overview.md` and drift risk.

This document indexes all validated, production-tested patterns in the codebase. **Claude MUST reference these patterns before writing new code.**

## Quick Reference

| Need to... | Reference File | Key Pattern |
|-----------|---------------|-------------|
| Create a new table | `.claude/scaffolds/crud-resource/migration.sql` | RLS + indexes + triggers |
| Fetch data with hooks | `frontend/src/hooks/use-companies.ts` | Options transform + refetch |
| CRUD service | `frontend/src/services/companyService.ts` | Pagination + filters + DTOs |
| API route | `.claude/scaffolds/crud-resource/api-route.ts` | Delegate to service |
| Form dialog | `frontend/src/components/domain/companies/CompanyFormDialog.tsx` | RHF + Zod + shadcn |
| List page | `frontend/src/app/(main)/[projectId]/directory/companies/page.tsx` | Search + table + actions |

---

## Critical Rules (From Incidents)

### 1. Foreign Key Types MUST Match

```sql
-- projects.id is INTEGER, so project_id must be INTEGER
project_id INTEGER NOT NULL REFERENCES projects(id)

-- WRONG: project_id UUID REFERENCES projects(id)
-- This will silently break all queries
```text
**Reference incident:** 2026-01-28, schedule_tasks used UUID for project_id

### 2. Route Parameters MUST Be Specific

```text
✓ [projectId], [companyId], [contractId], [taskId]
✗ [id] -- NEVER use generic [id]

```text
**Reference incident:** 2026-01-10, route conflicts broke dev server 3 times

### 3. Always Regenerate Types First

```bash
npm run db:types  # Before any database code
```

**Then read `frontend/src/types/database.types.ts` to verify.**

---

## Pattern: Project-Scoped Hook

**Reference:** `frontend/src/hooks/use-companies.ts`

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseXxxOptions {
  projectId: number | string;
  search?: string;
  enabled?: boolean;
}

export function useXxx(options: UseXxxOptions) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!options.enabled) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      // Query here
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed"));
    } finally {
      setIsLoading(false);
    }
  }, [/* deps */]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}
```typescript
**Key characteristics:**
- `"use client"` directive
- `createClient()` from `/lib/supabase/client`
- Error handling with setError
- refetch exposed for mutations
- Dependencies listed explicitly

---

## Pattern: Service Class

**Reference:** `frontend/src/services/companyService.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export class XxxService {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getItems(projectId: number, filters = {}) {
    // Pagination pattern
    const offset = (page - 1) * per_page;

    let query = this.supabase
      .from("table")
      .select("*", { count: "exact" })
      .eq("project_id", projectId)
      .range(offset, offset + per_page - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      data,
      pagination: {
        current_page: page,
        per_page,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / per_page),
      },
    };
  }
}
```tsx
**Key characteristics:**

- Accepts Supabase client in constructor
- Project-scoped queries (filter by project_id)
- Pagination response format
- Error handling with throw

---

## Pattern: API Route

**Reference:** `.claude/scaffolds/crud-resource/api-route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    const supabase = await createClient();
    // Delegate to service

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "..." }, { status: 500 });
  }
}
```tsx
**Key characteristics:**
- `createClient()` from `/lib/supabase/server`
- Await params (Next.js 15 pattern)
- Parse projectId to number
- Delegate to service, don't query directly
- Try/catch with proper error responses

---

## Pattern: Form Dialog

**Reference:** `frontend/src/components/domain/companies/CompanyFormDialog.tsx`

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Required"),
});

export function XxxFormDialog({ open, onOpenChange, item, onSuccess }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset(item ? { name: item.name } : { name: "" });
    }
  }, [open, item, form]);

  const onSubmit = async (data) => {
    try {
      // API call
      toast.success("Saved");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField ... />
          <Button type="submit">Save</Button>
        </form>
      </Form>
    </Dialog>
  );
}
```

**Key characteristics:**

- react-hook-form + Zod
- Reset form when dialog opens
- Toast notifications
- onSuccess callback for refetch
- Separate create/edit modes

---

## Pattern: Migration with RLS

**Reference:** `.claude/scaffolds/crud-resource/migration.sql`

```sql
CREATE TABLE xxx (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_xxx_project_id ON xxx(project_id);

-- Trigger
CREATE OR REPLACE FUNCTION update_xxx_updated_at() ...

-- RLS
ALTER TABLE xxx ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xxx_select" ON xxx FOR SELECT
USING (EXISTS (
    SELECT 1 FROM project_directory_memberships pdm
    JOIN people p ON p.id = pdm.person_id
    WHERE pdm.project_id = xxx.project_id
    AND p.auth_user_id = auth.uid()
));
```sql
**Key characteristics:**
- UUID for id, INTEGER for project_id
- ON DELETE CASCADE for FKs
- created_at/updated_at on every table
- RLS enabled with project membership check
- Index on project_id

---

## Anti-Patterns (DO NOT DO)

### ❌ Writing queries without reading types first
```typescript
// WRONG: Assuming columns exist
const { data } = await supabase.from("xxx").select("some_column");
```markdown
### ❌ Using generic [id] in routes

```text
// WRONG
app/api/projects/[id]/...

// RIGHT
app/api/projects/[projectId]/...
```

### ❌ UUID for project_id

```sql
-- WRONG: projects.id is INTEGER
project_id UUID REFERENCES projects(id)

-- RIGHT
project_id INTEGER REFERENCES projects(id)
```markdown
### ❌ Modifying code based on assumptions
```bash
// WRONG: grep shows column might not exist, so remove it
// RIGHT: Run actual query, see actual error, then fix

```

---

## Pattern Lookup by Task

| Task | Pattern |
|------|---------|
| Add new project-scoped feature | Use `/scaffold` command |
| Add dropdown to form | See `use-companies.ts` options pattern |
| Add bulk actions | See `DirectoryTable.tsx` selection pattern |
| Add search | See `CompanyFilters` interface pattern |
| Add pagination | See `CompanyListResponse` pattern |
| Add form validation | See Zod schema pattern above |
| Add delete confirmation | See `AlertDialog` pattern in page.tsx scaffold |
