---
name: alleato-detail-page
description: >
  Alleato PM detail-page pattern — the canonical way to build or update ANY entity
  detail/record page (submittals, prime contracts, commitments, RFIs, change orders,
  invoices, drawings, direct costs, estimates, companies, etc.). Use whenever you are
  asked to "create a detail page", "update the X detail page", "make X match prime
  contracts", fix a detail page's design, make detail fields editable, add attachments
  to a detail view, or align a detail page to the design system. Covers the header,
  tabs, inline-editable fields, sections, spacing tokens, attachments, the sidebar,
  and the inline-save handler — using the components that already exist so there is
  zero custom styling, zero hardcoded color/padding, and zero redirect-to-edit pages.
metadata:
  filePatterns:
    - "frontend/src/app/(main)/**/[*Id]/page.tsx"
    - "frontend/src/app/(main)/**/[*Id]/**/*.tsx"
    - "frontend/src/features/**/*detail*"
    - "frontend/src/components/domain/**/*detail*"
priority: 90
---

# Alleato Detail Page Pattern

The canonical reference is the **Prime Contracts detail page**:
`frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx`.
Every detail page in this app is assembled from the same small set of components. You are
almost never writing new UI — you are wiring existing components together correctly. If you
find yourself writing a `<div className="grid grid-cols-...">`, a `mt-6`, a `text-gray-500`,
or a "Edit" button that navigates to a separate page, **stop — you are doing it wrong.**

This skill exists because the pieces all already exist and are good; the only thing that ever
goes wrong is an agent not using them, redirecting to an edit page instead of editing inline,
or dropping fields that the create form has. The three checklists below make all three failures
impossible.

---

## Checklist 1 — Field parity (do this FIRST, before any JSX)

**Every field on the create/edit form must exist on the detail page.** A detail page that
shows fewer fields than the form that created the record is broken — the user can set a value
they can never see or change again.

1. Open the entity's create form + its Zod schema. Typical locations:
   - `frontend/src/features/<entity>/<entity>-form.tsx` (or `-create-form`, `-edit-form`)
   - `frontend/src/lib/schemas/<entity>.ts`
2. Write down **every** field the form writes (every `<FormField>` / every key in the schema).
3. For each one, confirm there is a matching field on the detail page. If it's missing, add it
   as an `EditableDetailField` (see Checklist 2). Do not silently skip "minor" fields.

> If a form field is a dropdown (select), you are also subject to the **Form ↔ DB FK Validation
> Gate** (`.claude/rules/FORM-FK-VALIDATION-GATE.md`). The inline-edit select control on the detail
> page must save the SAME id the FK column expects. Read that gate before wiring any editable
> dropdown.

---

## Checklist 2 — Every field is inline-editable (no redirect-to-edit, ever)

Fields are edited **in place on the detail page**. Clicking a field turns it into the right
editor (text/number/date/select/textarea), saves on blur/Enter, and reverts with a toast on
failure. There is **no separate `/edit` page** and **no global "Edit" mode toggle** for field
editing. Redirecting the user to a different page to change one field is the exact UX failure
this skill prevents.

Use **`EditableDetailField`** from `@/components/ds` for anything the user can change. Use
plain **`DetailField`** only for genuinely read-only / computed values (IDs, rollup totals,
created/updated timestamps).

```tsx
import { DetailField, DetailFieldGrid, EditableDetailField } from "@/components/ds";
import { StatusBadge } from "@/components/ds";

<DetailFieldGrid columns={2}>
  {/* Editable text */}
  <EditableDetailField
    label="Title"
    type="text"
    value={submittal.title ?? ""}
    onSave={(v) => handleSaveField("title", v)}
  />

  {/* Editable status — `display` renders the rich read-mode badge */}
  <EditableDetailField
    label="Status"
    type="select"
    value={submittal.status}
    display={<StatusBadge status={submittal.status} />}
    options={STATUS_OPTIONS}                 // [{ value, label }]
    onSave={(v) => handleSaveField("status", v)}
  />

  {/* Editable date — value is YYYY-MM-DD; display is the formatted read view */}
  <EditableDetailField
    label="Final Due"
    type="date"
    value={submittal.final_due_date ?? ""}
    display={submittal.final_due_date ? formatDate(submittal.final_due_date) : undefined}
    emptyPlaceholder="Set date"
    onSave={(v) => handleSaveField("final_due_date", v || null)}
  />

  {/* Editable currency — store the number, render formatCurrency in display */}
  <EditableDetailField
    label="Amount"
    type="number"
    value={String(contract.amount ?? "")}
    display={contract.amount != null ? formatCurrency(contract.amount) : undefined}
    onSave={(v) => handleSaveField("amount", v === "" ? null : Number(v))}
  />

  {/* Read-only / computed value */}
  <DetailField label="Created">{formatDate(submittal.created_at)}</DetailField>
</DetailFieldGrid>
```

### `EditableDetailField` / `InlineEditField` props

| Prop | Meaning |
|---|---|
| `label` | Field label (left column). |
| `type` | `"text" \| "number" \| "date" \| "select" \| "boolean" \| "textarea"`. Default `"text"`. |
| `value` | **Always a string.** date → `YYYY-MM-DD`, boolean → `"true"`/`"false"`, number → `String(n)`. |
| `display` | Optional rich read-mode node (a `<StatusBadge>`, a formatted date/currency). Falls back to `value`. |
| `options` | `{ value, label }[]` for `type="select"`. For `"boolean"` overrides the default Yes/No. |
| `emptyPlaceholder` | Affordance text shown when empty, e.g. `"Set date"`, `"Add note"`. |
| `onSave` | `(value: string) => Promise<void>`. **Throw to signal failure** — the field reverts and toasts the error. |
| `span` | `1 \| 2 \| 3` — span multiple grid columns (use `2`/`3` for long text/textarea). |

**Formatting is mandatory.** Money → `formatCurrency`, dates → `formatDate` (both from `@/lib/format`).
Never render a raw ISO string or an unformatted number to the user.

---

## Checklist 3 — Structure & spacing come from components, never from callsite classes

Assemble the page from these components. They already own all spacing — between sections, rows,
and columns. **Do not add `mt-*`, `mb-*`, `pt-*`, `pb-*`, `p-*`, `space-y-*`, or `gap-*` at the
callsite, and never a hardcoded color** (`text-gray-*`, `bg-white`, hex). If spacing looks wrong,
the fix is the right component/variant, not a one-off margin.

```tsx
import {
  PageShell,
  PageTabs,
  ContentSectionStack,
  DetailLayout,
  DetailPanel,
  SectionRuleHeading,
  SectionAction,
} from "@/components/layout";
import { DetailField, DetailFieldGrid, EditableDetailField, EntityAttachments } from "@/components/ds";

<PageShell
  variant="detail"          // see "Which variant" below
  eyebrow={<>{entity.number}</>}        // contract # / submittal # — optional
  title={entity.title}
  onBack={() => router.push(`/${projectId}/<entity-list>`)}
  actions={<PrimaryActions />}          // ONLY create/primary + a "More" menu. Not field edits.
>
  <PageTabs
    variant="inline"
    tabs={[
      { label: "General", href: "overview", isActive: tab === "overview" },
      { label: "Attachments", href: "attachments", isActive: tab === "attachments", count: docCount },
      // ...
    ]}
    onTabClick={(href) => setTab(href as Tab)}
  />

  <ContentSectionStack className="pt-3">      {/* owns space-y-10 between sections */}
    <DetailLayout sidebar={<EntitySidebar />}>  {/* omit `sidebar` for single-column */}
      <DetailPanel>
        <SectionRuleHeading label="General Information" />
        <DetailFieldGrid columns={2}>
          {/* EditableDetailField / DetailField — Checklist 2 */}
        </DetailFieldGrid>
      </DetailPanel>

      <section>
        <SectionRuleHeading label="Attachments" />
        <EntityAttachments
          entityType="submittal"        // see entityType union below
          entityId={String(entity.id)}
          projectId={projectId}
          showLabel={false}
        />
      </section>
    </DetailLayout>
  </ContentSectionStack>
</PageShell>
```

### What each component owns

| Concern | Component (import) | What it gives you — don't reinvent |
|---|---|---|
| Page header (title, eyebrow, back, primary actions) | `PageShell` (`@/components/layout`) | The header is the same on every page. Never hand-roll a title `<h1>` or a header bar. |
| Tabs | `PageTabs` `variant="inline"` (`@/components/layout`) | `tabs={[{label, href, isActive, count?}]}` + `onTabClick`. |
| Vertical rhythm between sections | `ContentSectionStack` (`@/components/layout`) | `space-y-10`. Wrap all tab content in it. |
| Two-column main + sidebar | `DetailLayout` (`@/components/layout`) | `sidebar` prop → two-column at `xl` (owns `gap-10`); omit → single column. **Never** hand-roll `grid xl:grid-cols-[...]` (ESLint `no-raw-detail-grid` blocks it). |
| A section block | `DetailPanel` (`@/components/layout`) | Rounded container, **no border, no bg fill, no card** — sections separate by spacing only (noise gate). |
| A summary/totals sidebar panel (financial summary, rollups) | `SummaryPanel` (`@/components/layout`) | The tinted very-light-gray container (`#FBFBFB` via `--surface-summary`). Owns its background, rounding, padding. **Never** `<DetailPanel className="bg-muted p-6">` or any hand-set background — the surface lives in one place so it can't drift. |
| Section heading + its CTA | `SectionRuleHeading` + `SectionAction` (`@/components/layout`) | Heading owns `mb-4`. The only allowed action button is `SectionAction` (outline/sm). Never a ghost button or plain `<Button>` in the actions slot. |
| Label + value column (read) | `DetailField` (`@/components/ds`) | Horizontal label-left/value-right, `formatCurrency`/`formatDate` via `currency`/`date` props. |
| Field grid | `DetailFieldGrid columns={2\|3\|4}` (`@/components/ds`) | Owns `gap-x-8 gap-y-6`. |
| Inline-editable field | `EditableDetailField` (`@/components/ds`) | Checklist 2. |
| Attachments | `EntityAttachments` (`@/components/ds`) | Upload + link + list. This is the ONLY attachments component — do not build a custom file list. |

### Which `PageShell` variant

| Page | variant |
|---|---|
| Detail with a status badge / record header | `detail` |
| Detail that needs the full width (wide tables in tabs) | `detailWide` |
| Dashboard-style record home (KPI-heavy, like prime contracts) | `dashboard` |

Single-column vs two-column is decided by whether you pass `DetailLayout`'s `sidebar` prop —
**not** by changing how you write the grid.

### `EntityAttachments` `entityType` (the only accepted values)

`project | subcontract | purchase_order | commitment | prime_contract | change_event | change_order | invoice | submittal | rfi | drawing | company`

---

## The inline-save handler

One handler per page. `apiFetch` (never raw `fetch`), `PUT` the single changed field, then
refresh React Query + the route so every view updates.

```tsx
import { apiFetch } from "@/lib/api-client";

const handleSaveField = useCallback(
  async (field: string, value: string | number | boolean | null) => {
    await apiFetch(`/api/projects/${projectId}/<entity>/${entity.id}`, {
      method: "PUT",
      body: JSON.stringify({ [field]: value }),
    });
    await queryClient.invalidateQueries({ queryKey: <entity>Keys.detail(Number(projectId), entity.id) });
    router.refresh();
  },
  [projectId, entity.id, queryClient, router],
);
```

`EditableDetailField` shows the success/error toast for you — your handler just needs to throw on
failure (an `apiFetch` non-2xx already throws, so you usually do nothing extra). Invalidating the
query is what makes the new value stick after navigation; skip it and the field "snaps back" when
the user returns — the exact bug that makes a detail page feel broken.

---

## Empty values (noise gate)

A genuinely empty **read-only** field should render **nothing extra** — prefer omitting the field
over showing a "—" dash. For **editable** empty fields, pass `emptyPlaceholder="Set X"` so there's
a clear affordance to click. (`DetailField` defaults to a muted "—"; pass `emptyPlaceholder=""` if
you want it blank.) Sections have no background fill, no border, no card wrapper — separation is by
spacing only.

---

## Forbidden — every one of these has shipped a broken page before

| Never | Always |
|---|---|
| A separate `/[id]/edit` page or global "Edit mode" to change a field | `EditableDetailField` inline on the detail page |
| `<div className="grid grid-cols-1 xl:grid-cols-[...]">` | `<DetailLayout sidebar={...}>` |
| `mt-*` / `mb-*` / `p-*` / `space-y-*` / `gap-*` at a callsite | the spacing baked into `ContentSectionStack` / `DetailFieldGrid` / `SectionRuleHeading` |
| Hardcoded color (`text-gray-500`, `bg-white`, hex) | semantic tokens (`text-muted-foreground`, `bg-card`, `border-border`) |
| A hand-rolled label+value `<div>` | `DetailField` / `EditableDetailField` |
| A custom file/attachment list | `EntityAttachments` |
| A ghost/plain `<Button>` in a section heading | `SectionAction` |
| A card/border/bg wrapping each section | `DetailPanel` (rounding only) + spacing |
| Raw ISO date or unformatted money in the UI | `formatDate` / `formatCurrency` |
| Detail page missing fields the create form has | Checklist 1 parity |
| Raw `fetch` for the save | `apiFetch` PUT + `invalidateQueries` + `router.refresh()` |

---

## Verify before you call it done

1. `cd frontend && npm run typecheck` (delegate the full run per CLAUDE.md if a sub-agent is free).
2. **Round-trip every editable field in the browser** (`agent-browser` or preview tools): click a
   field → change it → blur → confirm the toast → navigate away → return → the new value persists
   and any dropdown shows the saved selection (not "Select…"). A dropdown that reverts means an FK
   id mismatch — fix per the FK gate, do not ship it.
3. Confirm the field list on the page matches the create form (Checklist 1).
4. Noise-gate pass: no borders/cards around sections, no decorative icons, no dashes for empty
   read-only fields, no duplicate CTAs. Report pass/fail in your final message.

---

## Quick reference

| What | Value |
|---|---|
| Canonical example | `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx` |
| Layout barrel | `@/components/layout` — `PageShell`, `PageTabs`, `ContentSectionStack`, `DetailLayout`, `DetailPanel`, `SectionRuleHeading`, `SectionAction` |
| Field barrel | `@/components/ds` — `DetailField`, `DetailFieldGrid`, `EditableDetailField`, `EntityAttachments`, `StatusBadge` |
| Inline-edit field | `EditableDetailField` (wraps `InlineEditField`) |
| Attachments | `EntityAttachments` |
| Format helpers | `formatCurrency`, `formatDate` from `@/lib/format` |
| Save | `apiFetch` PUT `{ [field]: value }` → `invalidateQueries` → `router.refresh()` |
| FK gate (editable dropdowns) | `.claude/rules/FORM-FK-VALIDATION-GATE.md` |
| Detail-grid ESLint rule | `no-raw-detail-grid` |
