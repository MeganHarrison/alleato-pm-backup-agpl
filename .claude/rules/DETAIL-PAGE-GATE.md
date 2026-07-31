# Detail Page Gate

**Trigger:** Any time you are creating or updating an entity detail/record page — submittals,
prime contracts, commitments, RFIs, change orders, invoices, drawings, direct costs, estimates,
companies, or any `[*Id]/page.tsx` detail view. Also when asked to "make X match prime contracts",
make detail fields editable, add attachments to a detail view, or align a detail page to the
design system.

## Step 0 — MANDATORY before writing any detail-page JSX

Invoke the `alleato-detail-page` skill:

```
Skill("alleato-detail-page")
```

No exceptions. Every detail page in this repo is assembled from the same components, using the
Prime Contracts detail page as the canonical reference. If you build one without invoking this
skill first, you will get the structure, spacing, inline editing, or field parity wrong.

## What the skill enforces (three checklists)

1. **Field parity** — every field on the create/edit form exists on the detail page.
2. **Inline editing** — every editable field uses `EditableDetailField` in place. No redirect to
   a separate `/edit` page, no global edit-mode toggle to change a field.
3. **Components own structure & spacing** — `PageShell` header, `PageTabs`, `ContentSectionStack`,
   `DetailLayout`, `DetailPanel`, `SectionRuleHeading`/`SectionAction`, `DetailField` /
   `DetailFieldGrid` / `EditableDetailField`, `EntityAttachments`. Zero custom padding, zero
   hardcoded colors, zero hand-rolled grids.

## Forbidden patterns

| Never | Always |
|-------|--------|
| Separate `/[id]/edit` page or global edit mode for a field | `EditableDetailField` inline |
| `<div className="grid xl:grid-cols-[...]">` | `<DetailLayout sidebar={...}>` (ESLint `no-raw-detail-grid`) |
| `mt-*`/`mb-*`/`p-*`/`space-y-*`/`gap-*` at a callsite | spacing baked into the layout/grid/heading components |
| Hardcoded color (`text-gray-*`, `bg-white`, hex) | semantic tokens |
| Hand-rolled label+value `<div>` | `DetailField` / `EditableDetailField` |
| Custom file list | `EntityAttachments` |
| Ghost/plain `<Button>` in a section heading | `SectionAction` |
| Card/border/bg around each section | `DetailPanel` + spacing only |
| Detail page missing create-form fields | Checklist 1 parity |

## Reference implementation

- `frontend/src/app/(main)/[projectId]/prime-contracts/[contractId]/page.tsx`

## Why this gate exists

Updating the submittals detail page to "match prime contracts" took far longer than it should
have, repeatedly, because nothing forced an agent to use the existing components, edit fields
inline instead of redirecting to an edit page, or verify every create-form field appears on the
detail page. The components already exist and are good — the only failure mode is not using them.
This gate plus the skill remove that failure mode so the remaining ~10 detail pages are mechanical.
