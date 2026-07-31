# Project Documents Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clunky project documents page with a modern 3-zone browser — smart auto-folder rail, thumbnail grid/list, and a resizable side-by-side preview pane with a real PDF.js viewer and Office preview.

**Architecture:** A new client shell `ProjectDocumentsBrowser` renders three panes: a left smart-group rail, the existing `DocumentsTablePage` (grid/list over server-paginated `PipelineDoc`) in the middle, and a `PreviewPane` on the right. The grid and preview share a draggable, width-persisted divider. Smart groups are server-filter presets with counts from a new aggregate endpoint; dragging a doc onto a group reclassifies it via the existing assign-project PATCH route. Preview streams bytes from the existing `/api/files/[docId]/download` route, rendering PDFs with `react-pdf`, images natively, and Office files via a new Microsoft Graph preview route.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind, `react-pdf@10` (installed), `@dnd-kit/core@6` (installed), TanStack Query, Supabase. Jest for unit tests, Playwright for E2E.

## Global Constraints

- Design system only: tokens (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`), no hex/`gray-*`/`blue-*`, no `shadow-md`+. Use `@/components/ds` and `@/components/layout` before hand-rolling.
- `PageShell variant="detail"` for the page; horizontal label+value in any detail field.
- Data access from components via `apiFetch` from `@/lib/api-client` — never raw `fetch`. External calls in API routes via `fetchWithGuardrails` from `@/lib/fetch-with-guardrails`.
- API routes wrap handlers in `withApiGuardrails` and throw `GuardrailError` (see `frontend/src/app/api/projects/[projectId]/documents/[documentId]/download/route.ts`).
- No new `eslint-disable` or `any`. Run `cd frontend && npm run quality` before every commit.
- `projects.id` is INTEGER. `PipelineDoc.id` is a STRING (document_metadata UUID). `project_documents.id` is a NUMBER — do not cross the two.
- Commit directly to `main`, no `Co-Authored-By` trailer.

## Reference facts (verified by reading the code)

- Live page chain: `app/(main)/[projectId]/documents/page.tsx` → `DocumentsClient` (`documents-client.tsx`) → `DocumentsTablePage` (`features/documents/documents-table-page.tsx`) → `useServerTableDefinition` over `PipelineDoc`.
- `PipelineDoc` (in `features/documents/documents-table-config.tsx`): `{ id: string; title: string|null; document_type: string|null; category: string|null; source: string|null; source_system: string|null; source_web_url: string|null; storage_bucket: string|null; file_path: string|null; url: string|null; project_id: number|null; date: string|null; created_at: string|null; pipeline_stage: string; ... }`.
- Server fetch hits `/api/documents/status?...&project_id=<id>&document_type=<x>&page=<n>&per_page=<n>` and returns `{ documents: PipelineDoc[]; total; total_pages }` (see `documents-table-definition.ts` `fetchPage`).
- `DocumentFilterState` has `document_type`, `category`, `source`, `type`, `pipeline_stage`, `date_from`, `date_to` (all `FilterValue`).
- Inline field edit already works via `handleEditField` → `PATCH /api/documents/{docId}/assign-project` with body `{ [field]: value }`. Reclassify reuses this with `{ document_type: "<value>" }`.
- `DOCUMENT_TYPE_OPTIONS` (in `features/documents/document-types.ts`) are the canonical reclassify values: `drawing`, `submittal`, `contract`, `specification`, `rfi`, `change_order`, `photo`, `pay_app`, `schedule`, `psr`, `proposal`, `estimate`, `bid`, `permit`, `subcontract`, `safety`, `closeout`, `design`, `other`. `documentTypeLabel(value)` renders labels.
- Preview bytes for a `PipelineDoc`: `/api/files/${doc.id}/download?disposition=inline` (document_metadata route). The `project_documents` route (`/api/projects/[projectId]/documents/[id]/download`) is a DIFFERENT table — do not use it for `PipelineDoc`.
- Installed deps (no install needed): `react-pdf@^10.3.0`, `@react-pdf/renderer@^4.4.0`, `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`, `react-dropzone`, `xlsx`.

---

### Task 0: Verify the three integration routes (read-only spike)

No code change. Confirm the assumptions the rest of the plan builds on, so later tasks don't build on a wrong route. Produce a short notes file.

**Files:**
- Read: `frontend/src/app/api/documents/[docId]/assign-project/route.ts`
- Read: `frontend/src/app/api/files/[docId]/download/route.ts`
- Read: `frontend/src/app/api/documents/status/route.ts`
- Create: `docs/superpowers/plans/notes-task0.md`

- [ ] **Step 1: Confirm reclassify field is allowed**

In `assign-project/route.ts`, find the PATCH handler's allowed-fields list. Confirm `document_type` is accepted (or note the exact allow-list variable to extend). Write the finding to the notes file.

- [ ] **Step 2: Confirm inline preview works for document_metadata ids**

In `files/[docId]/download/route.ts`, confirm `GET ...?disposition=inline` resolves a `PipelineDoc.id` (document_metadata UUID) to streamable/redirectable bytes, and note how Microsoft/SharePoint-sourced rows behave (redirect vs. inline). Record whether Office files currently inline-preview (expected: no — needs Task 6).

- [ ] **Step 3: Confirm status endpoint shape + whether it can group**

In `documents/status/route.ts`, note the query it runs against `document_metadata` and whether a `group_by` or counts mode already exists. Record the exact column names used for `document_type`, `category`, `source`/`source_system`, and the project filter param.

- [ ] **Step 4: Commit notes**

```bash
git add -f docs/superpowers/plans/notes-task0.md
git commit -m "docs: task 0 integration verification notes for documents browser"
```

If Step 1 shows `document_type` is NOT allowed, add a sub-step in Task 8 to extend the allow-list; if Step 3 shows the status route cannot group, Task 2 builds a standalone count query (it does anyway).

---

### Task 1: Smart-group model (pure logic)

Define the smart groups as data: each maps to a server filter, an icon name, and an optional `reclassifyTo` (the `document_type` value applied when a doc is dropped on it). Format/source groups have `reclassifyTo: null` (not drop targets). All pure and unit-tested.

**Files:**
- Create: `frontend/src/features/documents/smart-groups.ts`
- Test: `frontend/src/features/documents/__tests__/smart-groups.test.ts`

**Interfaces:**
- Produces:
  - `type SmartGroupCounts = Record<string, number>`
  - `interface SmartGroup { id: string; label: string; icon: string; filter: Partial<DocumentFilterState>; reclassifyTo: string | null; }`
  - `const SMART_GROUPS: SmartGroup[]`
  - `function smartGroupCountKey(group: SmartGroup): string`
  - `function applySmartGroupFilter(base: DocumentFilterState, group: SmartGroup): DocumentFilterState`

- [ ] **Step 1: Write the failing test**

```ts
import {
  SMART_GROUPS,
  applySmartGroupFilter,
  smartGroupCountKey,
} from "@/features/documents/smart-groups";
import { EMPTY_DOCUMENT_FILTERS } from "@/features/documents/documents-table-definition";

describe("smart-groups", () => {
  it("includes an All group with no filter and no reclassify", () => {
    const all = SMART_GROUPS.find((g) => g.id === "all");
    expect(all).toBeDefined();
    expect(all!.filter).toEqual({});
    expect(all!.reclassifyTo).toBeNull();
  });

  it("maps Drawings to the drawing document_type and is a drop target", () => {
    const drawings = SMART_GROUPS.find((g) => g.id === "drawings");
    expect(drawings!.filter.document_type).toBe("drawing");
    expect(drawings!.reclassifyTo).toBe("drawing");
  });

  it("Photos group filters by document_type photo", () => {
    const photos = SMART_GROUPS.find((g) => g.id === "photos");
    expect(photos!.filter.document_type).toBe("photo");
  });

  it("applySmartGroupFilter overlays group filter onto base, clearing others", () => {
    const base = { ...EMPTY_DOCUMENT_FILTERS, category: "contract" };
    const drawings = SMART_GROUPS.find((g) => g.id === "drawings")!;
    const result = applySmartGroupFilter(base, drawings);
    expect(result.document_type).toBe("drawing");
    expect(result.category).toBeUndefined();
  });

  it("applySmartGroupFilter for All resets to empty filters", () => {
    const base = { ...EMPTY_DOCUMENT_FILTERS, document_type: "drawing" };
    const all = SMART_GROUPS.find((g) => g.id === "all")!;
    expect(applySmartGroupFilter(base, all)).toEqual(EMPTY_DOCUMENT_FILTERS);
  });

  it("count key is stable and unique per group", () => {
    const keys = SMART_GROUPS.map(smartGroupCountKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/features/documents/__tests__/smart-groups.test.ts`
Expected: FAIL — cannot find module `smart-groups`.

- [ ] **Step 3: Write the implementation**

```ts
import {
  EMPTY_DOCUMENT_FILTERS,
  type DocumentFilterState,
} from "@/features/documents/documents-table-definition";

export interface SmartGroup {
  id: string;
  label: string;
  icon: string;
  filter: Partial<DocumentFilterState>;
  reclassifyTo: string | null;
}

export type SmartGroupCounts = Record<string, number>;

export const SMART_GROUPS: SmartGroup[] = [
  { id: "all", label: "All", icon: "files", filter: {}, reclassifyTo: null },
  { id: "drawings", label: "Drawings", icon: "blueprints", filter: { document_type: "drawing" }, reclassifyTo: "drawing" },
  { id: "submittals", label: "Submittals", icon: "file-check", filter: { document_type: "submittal" }, reclassifyTo: "submittal" },
  { id: "contracts", label: "Contracts", icon: "file-text", filter: { document_type: "contract" }, reclassifyTo: "contract" },
  { id: "specs", label: "Specs", icon: "file-description", filter: { document_type: "specification" }, reclassifyTo: "specification" },
  { id: "rfis", label: "RFIs", icon: "help-circle", filter: { document_type: "rfi" }, reclassifyTo: "rfi" },
  { id: "change_orders", label: "Change Orders", icon: "file-diff", filter: { document_type: "change_order" }, reclassifyTo: "change_order" },
  { id: "photos", label: "Photos", icon: "photo", filter: { document_type: "photo" }, reclassifyTo: "photo" },
  { id: "emails", label: "Emails", icon: "mail", filter: { type: "email" }, reclassifyTo: null },
];

export function smartGroupCountKey(group: SmartGroup): string {
  return group.id;
}

export function applySmartGroupFilter(
  base: DocumentFilterState,
  group: SmartGroup,
): DocumentFilterState {
  return { ...EMPTY_DOCUMENT_FILTERS, ...group.filter };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/features/documents/__tests__/smart-groups.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/documents/smart-groups.ts frontend/src/features/documents/__tests__/smart-groups.test.ts
git commit -m "feat(documents): smart-group model for documents browser rail"
```

---

### Task 2: Group-counts API route

Aggregate per-group counts for a project over `document_metadata`, so the rail shows live totals across the whole project (not just the current page). One round-trip returning a `SmartGroupCounts` map.

**Files:**
- Create: `frontend/src/app/api/projects/[projectId]/documents/group-counts/route.ts`
- Test: covered by Task 10 E2E + a manual curl in Step 4 here.

**Interfaces:**
- Produces: `GET /api/projects/[projectId]/documents/group-counts` → `{ counts: Record<string, number> }` keyed by `SMART_GROUPS[].id`.

- [ ] **Step 1: Write the route**

Use the verified `document_metadata` column names from Task 0 notes. The handler counts rows per smart group using `count: "exact", head: true` queries (one per group), scoped to the project and `deleted_at is null`. Mirror the guardrail pattern from the download route.

```ts
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { SMART_GROUPS } from "@/features/documents/smart-groups";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails<{ projectId: string }>(
  "projects/[projectId]/documents/group-counts#GET",
  async ({ params }) => {
    const { projectId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/documents/group-counts#GET",
        message: "Authentication required.",
      });
    }

    const numericProjectId = Number(projectId);
    const counts: Record<string, number> = {};

    for (const group of SMART_GROUPS) {
      let query = supabase
        .from("document_metadata")
        .select("id", { count: "exact", head: true })
        .eq("project_id", numericProjectId)
        .is("deleted_at", null);

      if (group.filter.document_type) {
        query = query.eq("document_type", String(group.filter.document_type));
      }
      if (group.filter.type) {
        query = query.eq("type", String(group.filter.type));
      }

      const { count, error } = await query;
      if (error) {
        throw new GuardrailError({
          code: "QUERY_FAILED",
          where: "projects/[projectId]/documents/group-counts#GET",
          message: error.message,
        });
      }
      counts[group.id] = count ?? 0;
    }

    return NextResponse.json({ counts });
  },
);
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep group-counts || echo "no group-counts type errors"`
Expected: `no group-counts type errors`.

- [ ] **Step 3: Smoke the route against a real project**

Start dev (`cd frontend && npm run dev`), then in the browser-authenticated app open `/api/projects/1009/documents/group-counts`. Expected JSON: `{ "counts": { "all": <n>, "drawings": <n>, ... } }` with `all` ≥ every other count.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/api/projects/[projectId]/documents/group-counts/route.ts"
git commit -m "feat(documents): project document group-counts endpoint for smart rail"
```

---

### Task 3: Resizable split hook

A persisted, clamped split-ratio hook for the grid/preview divider. The pure clamp/persist logic is unit-tested; the pointer wiring is thin.

**Files:**
- Create: `frontend/src/features/documents/use-resizable-split.ts`
- Test: `frontend/src/features/documents/__tests__/use-resizable-split.test.ts`

**Interfaces:**
- Produces:
  - `function clampSplit(ratio: number, opts: { containerWidth: number; minPx: number }): number` — returns a ratio in [0,1] honoring a min pixel width on BOTH panes.
  - `function useResizableSplit(storageKey: string, defaultRatio?: number): { ratio: number; onHandleDown: (e: React.PointerEvent) => void; containerRef: React.RefObject<HTMLDivElement | null>; }`

- [ ] **Step 1: Write the failing test (pure clamp only)**

```ts
import { clampSplit } from "@/features/documents/use-resizable-split";

describe("clampSplit", () => {
  it("returns the ratio unchanged when within bounds", () => {
    expect(clampSplit(0.5, { containerWidth: 1000, minPx: 120 })).toBe(0.5);
  });

  it("clamps so the left pane keeps the min width", () => {
    expect(clampSplit(0.01, { containerWidth: 1000, minPx: 120 })).toBeCloseTo(0.12, 5);
  });

  it("clamps so the right pane keeps the min width", () => {
    expect(clampSplit(0.99, { containerWidth: 1000, minPx: 120 })).toBeCloseTo(0.88, 5);
  });

  it("never returns <0 or >1 for tiny containers", () => {
    const r = clampSplit(0.5, { containerWidth: 100, minPx: 120 });
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/features/documents/__tests__/use-resizable-split.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
"use client";

import * as React from "react";

export function clampSplit(
  ratio: number,
  opts: { containerWidth: number; minPx: number },
): number {
  const { containerWidth, minPx } = opts;
  if (containerWidth <= 0) return ratio;
  const minRatio = Math.min(0.5, minPx / containerWidth);
  const maxRatio = Math.max(0.5, 1 - minPx / containerWidth);
  const lo = Math.max(0, Math.min(minRatio, maxRatio));
  const hi = Math.min(1, Math.max(minRatio, maxRatio));
  return Math.min(hi, Math.max(lo, ratio));
}

const MIN_PANE_PX = 220;

export function useResizableSplit(storageKey: string, defaultRatio = 0.5) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = React.useState(defaultRatio);
  const draggingRef = React.useRef(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) setRatio(parsed);
    }
  }, [storageKey]);

  const persist = React.useCallback(
    (next: number) => {
      window.localStorage.setItem(storageKey, String(next));
    },
    [storageKey],
  );

  const onHandleDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      (e.target as Element).setPointerCapture?.(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const raw = (ev.clientX - rect.left) / rect.width;
        const next = clampSplit(raw, {
          containerWidth: rect.width,
          minPx: MIN_PANE_PX,
        });
        setRatio(next);
      };
      const onUp = () => {
        draggingRef.current = false;
        setRatio((current) => {
          persist(current);
          return current;
        });
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [persist],
  );

  return { ratio, onHandleDown, containerRef };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/features/documents/__tests__/use-resizable-split.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/documents/use-resizable-split.ts frontend/src/features/documents/__tests__/use-resizable-split.test.ts
git commit -m "feat(documents): persisted resizable split hook"
```

---

### Task 4: PipelineDoc preview helpers

Resolve the inline preview href and a coarse preview format for a `PipelineDoc`. Pure and unit-tested.

**Files:**
- Create: `frontend/src/features/documents/pipeline-doc-preview.ts`
- Test: `frontend/src/features/documents/__tests__/pipeline-doc-preview.test.ts`

**Interfaces:**
- Consumes: `PipelineDoc` from `@/features/documents/documents-table-config`.
- Produces:
  - `type PreviewKind = "pdf" | "image" | "office" | "text" | "none"`
  - `function pipelineDocInlineHref(doc: PipelineDoc): string` → `/api/files/${doc.id}/download?disposition=inline`
  - `function pipelineDocPreviewKind(doc: PipelineDoc): PreviewKind` — from title/file_path extension + source.
  - `function pipelineDocIsGraphSourced(doc: PipelineDoc): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import {
  pipelineDocInlineHref,
  pipelineDocPreviewKind,
  pipelineDocIsGraphSourced,
} from "@/features/documents/pipeline-doc-preview";
import type { PipelineDoc } from "@/features/documents/documents-table-config";

function doc(partial: Partial<PipelineDoc>): PipelineDoc {
  return {
    id: "abc", fireflies_id: null, title: null, status: null, type: null,
    category: null, document_type: null, source: null, source_system: null,
    source_web_url: null, date: null, created_at: null, captured_at: null,
    file_path: null, storage_bucket: null, url: null, project_id: 1,
    summary: null, overview: null, participants: null, participants_array: null,
    pipeline_stage: "embedded", attempt_count: 0, last_attempt_at: null,
    error_message: null, ...partial,
  };
}

describe("pipeline-doc-preview", () => {
  it("builds an inline href from the document id", () => {
    expect(pipelineDocInlineHref(doc({ id: "uuid-1" }))).toBe(
      "/api/files/uuid-1/download?disposition=inline",
    );
  });

  it("detects pdf by title extension", () => {
    expect(pipelineDocPreviewKind(doc({ title: "A-201.pdf" }))).toBe("pdf");
  });

  it("detects image by file_path extension", () => {
    expect(pipelineDocPreviewKind(doc({ file_path: "/x/site.PNG" }))).toBe("image");
  });

  it("detects office for docx/xlsx/pptx", () => {
    expect(pipelineDocPreviewKind(doc({ title: "rfi.docx" }))).toBe("office");
    expect(pipelineDocPreviewKind(doc({ title: "sov.xlsx" }))).toBe("office");
  });

  it("returns none for unknown/extensionless", () => {
    expect(pipelineDocPreviewKind(doc({ title: "meeting notes" }))).toBe("none");
  });

  it("flags microsoft_graph source", () => {
    expect(pipelineDocIsGraphSourced(doc({ source_system: "microsoft_graph" }))).toBe(true);
    expect(pipelineDocIsGraphSourced(doc({ source_system: "manual_upload" }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest src/features/documents/__tests__/pipeline-doc-preview.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```ts
import type { PipelineDoc } from "@/features/documents/documents-table-config";

export type PreviewKind = "pdf" | "image" | "office" | "text" | "none";

function extensionOf(doc: PipelineDoc): string {
  const source = doc.title ?? doc.file_path ?? doc.url ?? "";
  const match = source.toLowerCase().match(/\.([a-z0-9]+)(?:$|\?)/);
  return match ? match[1] : "";
}

export function pipelineDocInlineHref(doc: PipelineDoc): string {
  return `/api/files/${doc.id}/download?disposition=inline`;
}

export function pipelineDocPreviewKind(doc: PipelineDoc): PreviewKind {
  const ext = extensionOf(doc);
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  if (["txt", "md", "csv"].includes(ext)) return "text";
  return "none";
}

export function pipelineDocIsGraphSourced(doc: PipelineDoc): boolean {
  return doc.source_system === "microsoft_graph";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest src/features/documents/__tests__/pipeline-doc-preview.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/documents/pipeline-doc-preview.ts frontend/src/features/documents/__tests__/pipeline-doc-preview.test.ts
git commit -m "feat(documents): pipeline-doc preview href + kind helpers"
```

---

### Task 5: Graph Office preview route

For Office files sourced from OneDrive/SharePoint, return an embeddable Office Online preview URL via Microsoft Graph `getPreview`. Falls through (404) for non-Graph docs so the UI shows the download fallback.

**Files:**
- Create: `frontend/src/app/api/files/[docId]/office-preview/route.ts`
- Read for pattern: existing Graph-calling code (search `getGraphToken`/`graph.microsoft.com` under `frontend/src/lib` or `frontend/src/app/api`).

**Interfaces:**
- Produces: `GET /api/files/[docId]/office-preview` → `{ url: string }` (Office embed URL) or 404.

- [ ] **Step 1: Locate the Graph token helper**

Run: `cd frontend && grep -rl "graph.microsoft.com" src/lib src/app/api | head` and `grep -rn "getGraphToken\|appOnlyToken\|acquireToken" src/lib | head`. Use whatever app-only token helper already exists; if none, reuse the service that the download route's outlook attachment path uses. Record the import in the notes.

- [ ] **Step 2: Write the route**

Look up the doc's `source_drive_id` + `source_item_id` from `document_metadata`; if both present and `source_system = microsoft_graph`, call Graph `POST /drives/{driveId}/items/{itemId}/preview` via `fetchWithGuardrails`, returning `{ url: getUrl + "&nb=true" }`. Otherwise 404.

```ts
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchWithGuardrails } from "@/lib/fetch-with-guardrails";
import { NextResponse } from "next/server";
// import { getGraphAppToken } from "<resolved in Step 1>";

export const dynamic = "force-dynamic";

export const GET = withApiGuardrails<{ docId: string }>(
  "files/[docId]/office-preview#GET",
  async ({ params }) => {
    const { docId } = await params;
    const service = createServiceClient();
    const { data: doc, error } = await service
      .from("document_metadata")
      .select("id, source_system, source_drive_id, source_item_id")
      .eq("id", docId)
      .single<{
        id: string;
        source_system: string | null;
        source_drive_id: string | null;
        source_item_id: string | null;
      }>();

    if (error || !doc) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "files/[docId]/office-preview#GET",
        message: "Document not found.",
        status: 404,
      });
    }

    if (
      doc.source_system !== "microsoft_graph" ||
      !doc.source_drive_id ||
      !doc.source_item_id
    ) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "files/[docId]/office-preview#GET",
        message: "No Office preview available for this document.",
        status: 404,
      });
    }

    const token = await getGraphAppToken();
    const res = await fetchWithGuardrails(
      `https://graph.microsoft.com/v1.0/drives/${doc.source_drive_id}/items/${doc.source_item_id}/preview`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );

    if (!res.ok) {
      throw new GuardrailError({
        code: "UPSTREAM_ERROR",
        where: "files/[docId]/office-preview#GET",
        message: `Graph preview failed (${res.status}).`,
        status: 502,
      });
    }

    const json = (await res.json()) as { getUrl?: string };
    if (!json.getUrl) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "files/[docId]/office-preview#GET",
        message: "Graph did not return a preview URL.",
        status: 404,
      });
    }

    return NextResponse.json({ url: `${json.getUrl}&nb=true` });
  },
);
```

Replace `getGraphAppToken` with the helper resolved in Step 1.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep office-preview || echo "no office-preview type errors"`
Expected: `no office-preview type errors`.

- [ ] **Step 4: Smoke against a known OneDrive-sourced docx**

Find a Graph-sourced docx id from `document_metadata` and open `/api/files/<id>/office-preview` in the app. Expected `{ "url": "https://...office.com/...&nb=true" }`. A non-Graph id returns 404 (expected).

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/api/files/[docId]/office-preview/route.ts"
git commit -m "feat(documents): microsoft graph office preview route"
```

---

### Task 6: PreviewPane component

The right pane: a toolbar (title, zoom for PDF, download, info toggle), a body that renders by `PreviewKind`, and a metadata strip behind the info toggle. PDFs use `react-pdf`; images native; office via the Graph route (with download fallback); everything else a clean `EmptyState` with a download action.

**Files:**
- Create: `frontend/src/features/documents/preview-pane.tsx`
- Create: `frontend/src/features/documents/pdf-preview.tsx`

**Interfaces:**
- Consumes: `PipelineDoc`, `pipelineDocInlineHref`, `pipelineDocPreviewKind`, `pipelineDocIsGraphSourced`, `apiFetch`.
- Produces: `function PreviewPane({ doc }: { doc: PipelineDoc | null }): React.ReactElement`

- [ ] **Step 1: Write the PDF viewer wrapper**

`react-pdf` needs its worker configured once. Render all pages in a scroll container at a zoom controlled by props.

```tsx
"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export function PdfPreview({ src, scale }: { src: string; scale: number }) {
  const [numPages, setNumPages] = React.useState(0);
  return (
    <div className="flex h-full w-full justify-center overflow-auto bg-muted/40 p-4">
      <Document
        file={src}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}
        error={<div className="p-8 text-sm text-muted-foreground">Could not render this PDF.</div>}
      >
        {Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            scale={scale}
            className="mb-4 border border-border bg-background"
            renderTextLayer
            renderAnnotationLayer
          />
        ))}
      </Document>
    </div>
  );
}
```

- [ ] **Step 2: Write the PreviewPane**

```tsx
"use client";

import * as React from "react";
import { Download, Info, ZoomIn, ZoomOut, FileText } from "lucide-react";

import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import type { PipelineDoc } from "@/features/documents/documents-table-config";
import {
  pipelineDocInlineHref,
  pipelineDocPreviewKind,
  pipelineDocIsGraphSourced,
} from "@/features/documents/pipeline-doc-preview";
import { documentTypeLabel } from "@/features/documents/document-types";
import { PdfPreview } from "@/features/documents/pdf-preview";
import { formatDate } from "@/lib/format";

export function PreviewPane({ doc }: { doc: PipelineDoc | null }) {
  const [scale, setScale] = React.useState(1);
  const [showInfo, setShowInfo] = React.useState(false);
  const [officeUrl, setOfficeUrl] = React.useState<string | null>(null);
  const [officeError, setOfficeError] = React.useState(false);

  const kind = doc ? pipelineDocPreviewKind(doc) : "none";
  const inlineHref = doc ? pipelineDocInlineHref(doc) : "";
  const downloadHref = doc ? `/api/files/${doc.id}/download` : "";

  React.useEffect(() => {
    setOfficeUrl(null);
    setOfficeError(false);
    setScale(1);
    if (doc && kind === "office" && pipelineDocIsGraphSourced(doc)) {
      apiFetch<{ url: string }>(`/api/files/${doc.id}/office-preview`)
        .then((r) => setOfficeUrl(r.url))
        .catch(() => setOfficeError(true));
    }
  }, [doc, kind]);

  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-8">
        <EmptyState
          icon={<FileText />}
          title="Select a document"
          description="Choose a document to preview it here."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {doc.title ?? "Untitled"}
        </p>
        {kind === "pdf" && (
          <>
            <button aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.5, s - 0.1))} className="text-muted-foreground hover:text-foreground">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
            <button aria-label="Zoom in" onClick={() => setScale((s) => Math.min(3, s + 0.1))} className="text-muted-foreground hover:text-foreground">
              <ZoomIn className="h-4 w-4" />
            </button>
          </>
        )}
        <a href={downloadHref} download className="text-muted-foreground hover:text-foreground" aria-label="Download">
          <Download className="h-4 w-4" />
        </a>
        <button aria-label="Toggle info" onClick={() => setShowInfo((v) => !v)} className="text-muted-foreground hover:text-foreground">
          <Info className="h-4 w-4" />
        </button>
      </div>

      {showInfo && (
        <div className="border-b border-border bg-muted/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-4 py-1">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Type</span>
            <span className="text-foreground">{documentTypeLabel(doc.document_type)}</span>
          </div>
          <div className="flex items-center gap-4 py-1">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Source</span>
            <span className="text-foreground">{doc.source ?? doc.source_system ?? "—"}</span>
          </div>
          <div className="flex items-center gap-4 py-1">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">Added</span>
            <span className="text-foreground">{formatDate(doc.created_at ?? doc.date)}</span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {kind === "pdf" && <PdfPreview src={inlineHref} scale={scale} />}
        {kind === "image" && (
          <div className="flex h-full items-start justify-center overflow-auto bg-muted/40 p-4">
            <img src={inlineHref} alt={doc.title ?? ""} className="max-w-full object-contain" />
          </div>
        )}
        {kind === "text" && (
          <iframe src={inlineHref} title={`${doc.title} preview`} className="h-full w-full bg-background" />
        )}
        {kind === "office" && officeUrl && (
          <iframe src={officeUrl} title={`${doc.title} preview`} className="h-full w-full bg-background" />
        )}
        {kind === "office" && !officeUrl && (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              icon={<FileText />}
              title={officeError ? "Preview unavailable" : "Preparing preview…"}
              description="Download the file to view it."
              action={<Button asChild size="sm" variant="outline"><a href={downloadHref} download>Download</a></Button>}
            />
          </div>
        )}
        {kind === "none" && (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              icon={<FileText />}
              title="Preview not available for this file type"
              description="Download the file to view it."
              action={<Button asChild size="sm" variant="outline"><a href={downloadHref} download>Download</a></Button>}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "preview-pane|pdf-preview" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/documents/preview-pane.tsx frontend/src/features/documents/pdf-preview.tsx
git commit -m "feat(documents): preview pane with pdf.js, image, and office preview"
```

---

### Task 7: Smart-group rail with drop targets

The left rail: list `SMART_GROUPS` with live counts and selection; each `reclassifyTo` group is a `@dnd-kit` droppable that highlights on drag-over. Icons map from the `icon` string to lucide components.

**Files:**
- Create: `frontend/src/features/documents/smart-group-rail.tsx`

**Interfaces:**
- Consumes: `SMART_GROUPS`, `SmartGroupCounts`.
- Produces: `function SmartGroupRail({ counts, activeGroupId, onSelect }: { counts: SmartGroupCounts; activeGroupId: string; onSelect: (groupId: string) => void; }): React.ReactElement`. Each droppable uses `useDroppable({ id: "group:" + group.id })`.

- [ ] **Step 1: Write the rail**

```tsx
"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Files, FileText, FileCheck, FileDiff, Mail, Photo, HelpCircle, FileDescription, Blueprints, type LucideIcon,
} from "lucide-react";

import { SMART_GROUPS, type SmartGroup, type SmartGroupCounts } from "@/features/documents/smart-groups";

const ICONS: Record<string, LucideIcon> = {
  files: Files,
  blueprints: Blueprints,
  "file-check": FileCheck,
  "file-text": FileText,
  "file-description": FileDescription,
  "help-circle": HelpCircle,
  "file-diff": FileDiff,
  photo: Photo,
  mail: Mail,
};

function RailItem({
  group, count, active, onSelect,
}: { group: SmartGroup; count: number; active: boolean; onSelect: () => void }) {
  const droppable = group.reclassifyTo
    ? useDroppable({ id: `group:${group.id}` })
    : null;
  const Icon = ICONS[group.icon] ?? Files;
  return (
    <button
      ref={droppable?.setNodeRef}
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50",
        droppable?.isOver ? "ring-2 ring-primary ring-inset" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{group.label}</span>
      <span className="text-xs tabular-nums">{count}</span>
    </button>
  );
}

export function SmartGroupRail({
  counts, activeGroupId, onSelect,
}: { counts: SmartGroupCounts; activeGroupId: string; onSelect: (groupId: string) => void }) {
  return (
    <nav className="flex h-full w-full flex-col gap-0.5 overflow-y-auto border-r border-border bg-muted/30 p-2">
      <p className="px-2 pb-1 pt-1 text-[11px] uppercase tracking-wide text-muted-foreground">Smart groups</p>
      {SMART_GROUPS.map((group) => (
        <RailItem
          key={group.id}
          group={group}
          count={counts[group.id] ?? 0}
          active={group.id === activeGroupId}
          onSelect={() => onSelect(group.id)}
        />
      ))}
    </nav>
  );
}
```

Note: if `Blueprints`/`FileDescription` are not exported by the installed lucide version, substitute the nearest available icon (verify with `grep "export" node_modules/lucide-react/dist/lucide-react.d.ts | grep -i blueprint`). Keep the `ICONS` map the single place to change.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep smart-group-rail || echo "clean"`
Expected: `clean`. If an icon import errors, swap it per the note and re-run.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/documents/smart-group-rail.tsx
git commit -m "feat(documents): smart-group rail with dnd drop targets"
```

---

### Task 8: Assemble the ProjectDocumentsBrowser shell

Wire it together: rail + middle (the existing `DocumentsTablePage`, made selection-aware) + resizable `PreviewPane`. A `DndContext` wraps the middle+rail so dragging a doc card onto a `reclassifyTo` group PATCHes `document_type`. Selecting a card sets the preview doc instead of navigating. Group selection drives the table's `document_type`/`type` filter via the URL.

**Files:**
- Create: `frontend/src/features/documents/project-documents-browser.tsx`
- Modify: `frontend/src/app/(main)/[projectId]/documents/documents-client.tsx`
- Modify: `frontend/src/features/documents/documents-table-page.tsx` (add optional `onSelect` + `selectedId` passthrough to card/list renderers; add optional `draggableCards` flag)

**Interfaces:**
- Consumes: `DocumentsTablePage`, `createDocumentsTableDefinition`, `SmartGroupRail`, `PreviewPane`, `useResizableSplit`, `applySmartGroupFilter`, `SMART_GROUPS`, `apiFetch`.
- Produces: `function ProjectDocumentsBrowser({ projectId, projectName }: { projectId: number; projectName?: string }): React.ReactElement`.

- [ ] **Step 1: Make DocumentsTablePage selection-aware (minimal, backward-compatible)**

Add three optional props and thread them into the `views` renderers and (optionally) the table row click. Default behavior unchanged when props are absent.

In `DocumentsTablePageProps` add:
```tsx
  selectedDocId?: string;
  onSelectDoc?: (doc: PipelineDoc) => void;
  draggableCards?: boolean;
```
In the component, replace the `views` block so a provided `onSelectDoc` overrides `handleView`:
```tsx
        views={{
          card: (item) =>
            (customRenderCard ?? renderDocumentCard)(
              item,
              onSelectDoc ?? handleView,
            ),
          list: (item) =>
            (customRenderList ?? renderDocumentList)(
              item,
              onSelectDoc ?? handleView,
            ),
        }}
```
Leave drag wiring to the card renderer wrapper in Step 3 (do not modify `renderDocumentCard` itself).

- [ ] **Step 2: Build the browser shell**

```tsx
"use client";

import * as React from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";
import { DocumentsTablePage } from "@/features/documents/documents-table-page";
import { createDocumentsTableDefinition } from "@/features/documents/documents-table-definition";
import type { PipelineDoc } from "@/features/documents/documents-table-config";
import { SmartGroupRail } from "@/features/documents/smart-group-rail";
import { PreviewPane } from "@/features/documents/preview-pane";
import { useResizableSplit } from "@/features/documents/use-resizable-split";
import {
  SMART_GROUPS,
  type SmartGroupCounts,
} from "@/features/documents/smart-groups";

export function ProjectDocumentsBrowser({
  projectId,
  projectName,
}: {
  projectId: number;
  projectName?: string;
}) {
  const [activeGroupId, setActiveGroupId] = React.useState("all");
  const [selectedDoc, setSelectedDoc] = React.useState<PipelineDoc | null>(null);
  const [counts, setCounts] = React.useState<SmartGroupCounts>({});
  const { ratio, onHandleDown, containerRef } = useResizableSplit(
    "documents-browser-split",
    0.5,
  );
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const loadCounts = React.useCallback(() => {
    apiFetch<{ counts: SmartGroupCounts }>(
      `/api/projects/${projectId}/documents/group-counts`,
    )
      .then((r) => setCounts(r.counts))
      .catch(() => setCounts({}));
  }, [projectId]);

  React.useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const activeGroup = SMART_GROUPS.find((g) => g.id === activeGroupId) ?? SMART_GROUPS[0];

  const definition = React.useMemo(
    () =>
      createDocumentsTableDefinition({
        entityKey: "project-documents-unified",
        forcedProjectId: projectId,
        defaultFilters: activeGroup.filter,
      }),
    [projectId, activeGroup],
  );

  const handleDragEnd = React.useCallback(
    async (event: DragEndEvent) => {
      const overId = event.over?.id;
      const docId = event.active?.id;
      if (typeof overId !== "string" || typeof docId !== "string") return;
      if (!overId.startsWith("group:")) return;
      const group = SMART_GROUPS.find((g) => `group:${g.id}` === overId);
      if (!group?.reclassifyTo) return;

      try {
        await apiFetch(`/api/documents/${docId}/assign-project`, {
          method: "PATCH",
          body: JSON.stringify({ document_type: group.reclassifyTo }),
        });
        toast.success(`Moved to ${group.label}`);
        loadCounts();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not reclassify document",
        );
      }
    },
    [loadCounts],
  );

  return (
    <PageShell variant="detail" title="Documents" eyebrow={projectName} contentClassName="p-0">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex h-[calc(100vh-9rem)] w-full overflow-hidden rounded-lg border border-border">
          <div className="w-44 shrink-0">
            <SmartGroupRail
              counts={counts}
              activeGroupId={activeGroupId}
              onSelect={(id) => setActiveGroupId(id)}
            />
          </div>
          <div ref={containerRef} className="flex min-w-0 flex-1">
            <div className="min-w-0 overflow-auto" style={{ flexBasis: `${ratio * 100}%` }}>
              <DocumentsTablePage
                key={activeGroupId}
                definition={definition}
                title="Documents"
                description="Project document library"
                uploadEnabled
                uploadProjectId={projectId}
                inlineEditingEnabled
                projectAssignmentEnabled={false}
                deleteEnabled
                pageArea="project-documents-browser"
                selectedDocId={selectedDoc?.id}
                onSelectDoc={setSelectedDoc}
                draggableCards
              />
            </div>
            <div
              onPointerDown={onHandleDown}
              className="flex w-2 shrink-0 cursor-col-resize items-center justify-center border-x border-border bg-muted/40 text-muted-foreground"
              role="separator"
              aria-label="Resize preview"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <PreviewPane doc={selectedDoc} />
            </div>
          </div>
        </div>
      </DndContext>
    </PageShell>
  );
}
```

- [ ] **Step 3: Make cards draggable**

Wrap the card renderer in a `useDraggable` component when `draggableCards` is set. Add to `documents-table-page.tsx` a small wrapper used in the `views.card` slot when `draggableCards` is true:
```tsx
import { useDraggable } from "@dnd-kit/core";

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-50" : ""}>
      {children}
    </div>
  );
}
```
and in the `views.card` slot:
```tsx
        views={{
          card: (item) => {
            const node = (customRenderCard ?? renderDocumentCard)(item, onSelectDoc ?? handleView);
            return draggableCards ? <DraggableCard id={item.id}>{node}</DraggableCard> : node;
          },
          list: (item) => (customRenderList ?? renderDocumentList)(item, onSelectDoc ?? handleView),
        }}
```

- [ ] **Step 4: Swap the page to the new browser**

Replace `documents-client.tsx` body:
```tsx
"use client";

import { ProjectDocumentsBrowser } from "@/features/documents/project-documents-browser";
import { useOptionalProject } from "@/contexts/project-context";

type DocumentsClientProps = { projectId: string };

export function DocumentsClient({ projectId }: DocumentsClientProps) {
  const numericProjectId = Number.parseInt(projectId, 10);
  const projectName = useOptionalProject()?.selectedProject?.name ?? undefined;
  return (
    <ProjectDocumentsBrowser
      projectId={Number.isFinite(numericProjectId) ? numericProjectId : 0}
      projectName={projectName}
    />
  );
}
```

- [ ] **Step 5: Default the table to card view in the browser**

Since the browser wants the grid by default, set `defaultView: "card"` via the definition options if needed — confirm `createDocumentsTableDefinition` sets `defaultView`. It currently hardcodes `"table"`. Add a `defaultView?: "table" | "card" | "list"` option to `DocumentsTableDefinitionOptions` and use it (default `"table"`), then pass `defaultView: "card"` from the browser. Edit `documents-table-definition.ts`:
```tsx
// in DocumentsTableDefinitionOptions
  defaultView?: "table" | "card" | "list";
// in the returned definition
    defaultView: options.defaultView ?? "table",
```
and in the browser's `createDocumentsTableDefinition({ ... })` add `defaultView: "card"`.

- [ ] **Step 6: Typecheck, lint, build**

Run: `cd frontend && npm run quality`
Expected: PASS. Fix any type errors surfaced in the touched files.

- [ ] **Step 7: Manual verification in browser**

Start dev, open `/1009/documents`. Confirm: rail shows groups with counts; clicking a card shows it in the preview; dragging the divider resizes and the ratio persists after reload; dragging a card onto "Drawings" shows a success toast and the count updates.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/documents/project-documents-browser.tsx \
  "frontend/src/app/(main)/[projectId]/documents/documents-client.tsx" \
  frontend/src/features/documents/documents-table-page.tsx \
  frontend/src/features/documents/documents-table-definition.ts
git commit -m "feat(documents): assemble resizable project documents browser shell"
```

---

### Task 9: E2E smoke (Playwright)

Lock the happy path against regressions.

**Files:**
- Create: `frontend/tests/e2e/project-documents-browser.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";

test.describe("project documents browser", () => {
  test("rail, selection, and resize work", async ({ page }) => {
    await page.goto("/1009/documents");

    await expect(page.getByText("Smart groups")).toBeVisible();
    await expect(page.getByRole("button", { name: /All/ })).toBeVisible();

    const firstCard = page.getByRole("button", { name: /Preview / }).first();
    await firstCard.click();

    await expect(page.getByLabel("Toggle info")).toBeVisible();

    const handle = page.getByRole("separator", { name: "Resize preview" });
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.move(box.x + 1, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x - 150, box.y + box.height / 2);
      await page.mouse.up();
    }

    await page.reload();
    await expect(page.getByText("Smart groups")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd frontend && npx playwright test tests/e2e/project-documents-browser.spec.ts`
Expected: PASS. If the auth session is stale, run `npx playwright test tests/auth.setup.ts` once, then retry.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/e2e/project-documents-browser.spec.ts
git commit -m "test(documents): e2e smoke for project documents browser"
```

---

### Task 10: Delegate full verification + noise-gate pass

**Files:** none.

- [ ] **Step 1: Delegate quality gate to a sub-agent**

Dispatch a lower-cost sub-agent to run `cd frontend && npm run quality` and the two new Jest files + the Playwright spec, returning pass/fail with concise errors. Fix any blockers in the owning files.

- [ ] **Step 2: Noise-gate self-check**

Confirm against `docs/design/noise-gate-log.md`: no section borders/cards beyond the single outer browser frame, no decorative icons (rail icons are the sole affordance — allowed), empty fields render nothing, secondary add actions are bare. Record pass/fail in the final response.

- [ ] **Step 3: Final commit if any fixes**

```bash
git add -A && git commit -m "polish(documents): quality + noise-gate fixes for documents browser"
```

---

## Self-Review

**Spec coverage:** Layout (Task 8) ✓ · equal-width default + resizable persisted divider (Tasks 3, 8) ✓ · smart auto-folders + counts (Tasks 1, 2) ✓ · saved views (existing `savedViewsScope` in `DocumentsTablePage` — retained, not rebuilt) ✓ · drag-to-reclassify (Tasks 7, 8) ✓ · PDF.js viewer (Task 6) ✓ · Graph Office preview + download fallback (Tasks 5, 6) ✓ · thumbnails (existing `renderDocumentCard` image/pdf thumbnails are reused; type-icon fallback already present) ✓ · grid default (Task 8 Step 5) ✓. Phase 2 items (dedup, Office-on-Supabase conversion, versioning) intentionally excluded.

**Deferred-but-noted:** "thumbnails for Office files" — `renderDocumentCard` shows a type icon for Office; a true first-page Office thumbnail depends on the same Graph thumbnail API and is folded into Phase 2. Not a Phase 1 gap.

**Type consistency:** `PipelineDoc.id` is `string` throughout (rail droppable `group:<id>`, draggable card `item.id`, preview href). Reclassify uses `document_type` values from `DOCUMENT_TYPE_OPTIONS`. `applySmartGroupFilter` returns a full `DocumentFilterState`. `clampSplit`/`useResizableSplit` names match between Task 3 and Task 8.

**Open risks flagged for the implementer:** Task 0 must confirm the assign-project PATCH allows `document_type` (else extend its allow-list — add a step in Task 8); Task 5 Step 1 must resolve the real Graph token helper before the route compiles; Task 7 must confirm lucide icon names exist in the installed version.
