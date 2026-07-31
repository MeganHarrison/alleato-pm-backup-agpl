# Alleato: Missing Component Specs

> These are the composed "molecule" components that the design system is missing.
> Each one eliminates a category of inconsistency by making the correct pattern the only option.
> All components go in `frontend/src/components/ds/`, exported from `index.ts`.

---

## Existing Foundation (DO NOT REBUILD)

Before building anything, know what already exists:

**Custom DS components** (`@/components/ds/`):
- `StatusBadge`, `StatusDot`, `StatusText` — status display (colors automatic)
- `KpiBlock`, `KpiRow` — metric display
- `SectionHeader` — title + count + action
- `AvatarStack` — overlapping avatar initials
- `DateAvatar` — date display as avatar
- `DataTable` — simple data table
- `EmptyState` — icon + title + description + action
- `Eyebrow` — 11px uppercase label

**Layout components** (`@/components/layout/`):
- `PageShell` — THE page wrapper (5 variants: dashboard, table, form, detail, content)
- `PageContainer` — responsive padding wrapper (px-3 sm:px-5 lg:px-7)
- `PageHeader` — title + actions bar
- `PageTabs` — underline tab navigation

**shadcn primitives** (`@/components/ui/`):
- `Button` — with size tiers: xs(24px), sm(32px), default(36px), lg(40px), icon, icon-xs, icon-sm, icon-lg
- All standard shadcn: Card, Dialog, Sheet, Tabs, Input, Select, etc.

**Table system** (`@/components/tables/unified/`):
- `UnifiedTablePage` — full-featured table with toolbar, search, filters
- Cell primitives: `CellText`, `CellCurrency`, `CellDate`, `CellStatus`, `CellLink`, etc.

---

## Component 1: DetailActions

**Problem it solves:** Every detail page (commitments, prime contracts, direct costs, change orders, etc.) has action buttons in the header. Currently each page hand-rolls these with different Button variants, sizes, gaps, and icon treatments.

**Location:** `frontend/src/components/ds/detail-actions.tsx`

**API:**
```tsx
interface DetailActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onEmail?: () => void;
  onExport?: () => void;
  onPrint?: () => void;
  /** Additional custom actions rendered before the standard ones */
  children?: React.ReactNode;
  /** Whether to show delete with destructive styling. Default: true */
  showDeleteAsDestructive?: boolean;
  /** Size tier for all buttons. Default: "sm" */
  size?: "sm" | "default";
}
```

**Visual spec:**
- Container: `flex items-center gap-1.5`
- Each action: `<Button variant="ghost" size="icon-sm">` (32px, matching size="sm" text buttons)
- Icon size: automatic (Button handles via `[&_svg]:size-4`)
- Delete button: `className="text-muted-foreground hover:text-destructive"`
- Order: children → email → export → print → edit → delete
- Tooltip on each icon button with the action name

**Icons (from lucide-react):**
- Edit: `Pencil`
- Delete: `Trash2`
- Email: `Mail`
- Export: `Download`
- Print: `Printer`

**Usage:**
```tsx
<PageShell variant="detail" title="Contract #1042" actions={
  <DetailActions onEdit={handleEdit} onDelete={handleDelete} onEmail={handleEmail} />
}>
```

---

## Component 2: FormActions

**Problem it solves:** Every form page has Cancel + Save buttons. Currently each does it differently — different variants, different sizes, different loading text, different disabled logic.

**Location:** `frontend/src/components/ds/form-actions.tsx`

**API:**
```tsx
interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;        // Default: "Save"
  submittingLabel?: string;    // Default: "Saving..."
  cancelLabel?: string;        // Default: "Cancel"
  /** Additional buttons between cancel and submit */
  children?: React.ReactNode;
  /** Size tier. Default: "sm" */
  size?: "sm" | "default";
}
```

**Visual spec:**
- Container: `flex items-center gap-2`
- Cancel: `<Button variant="outline" size="sm">`
- Submit: `<Button size="sm" disabled={isSubmitting}>`
- When submitting: button text changes, button disabled
- No icons on cancel/submit (text only)

**Usage:**
```tsx
<PageShell variant="form" title="Edit Contract" actions={
  <FormActions onCancel={() => router.back()} onSubmit={form.handleSubmit(handleSave)} isSubmitting={isSaving} />
}>
```

---

## Component 3: EditModeActions

**Problem it solves:** 6+ detail pages have a view/edit toggle. Each implements the edit mode actions (Cancel Edit + Save Changes) differently.

**Location:** `frontend/src/components/ds/edit-mode-actions.tsx`

**API:**
```tsx
interface EditModeActionsProps {
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  isSaving?: boolean;
  /** Actions shown in view mode. Default: edit pencil icon */
  viewActions?: React.ReactNode;
}
```

**Visual spec:**
- View mode: renders `viewActions` (default: ghost pencil icon button)
- Edit mode: `<FormActions onCancel={onCancelEdit} onSubmit={onSave} isSubmitting={isSaving} submitLabel="Save Changes" />`

---

## Component 4: SplitButton

**Problem it solves:** The "Create ▾" dropdown pattern appears on multiple pages. Currently it's two separate Button elements in a flex div — they can have different heights and the gap between them looks wrong.

**Location:** `frontend/src/components/ds/split-button.tsx`

**API:**
```tsx
interface SplitButtonProps {
  label: string;
  icon?: React.ReactNode;
  items: { label: string; icon?: React.ReactNode; onClick: () => void }[];
  size?: "sm" | "default";
  variant?: "default" | "outline";
}
```

**Visual spec:**
- Single cohesive unit with shared border-radius
- Left side: icon + label (clickable for primary action OR just triggers dropdown)
- Right side: ChevronDown separator (opens dropdown)
- Both halves: same height, same variant
- Uses `<DropdownMenu>` for the menu

**Alternative approach:** If the button ONLY opens a dropdown (no primary action), just render as a single `<Button>` with ChevronDown:
```tsx
<Button size="sm"><Plus /> Create <ChevronDown /></Button>
```
The Button's built-in `gap-2`/`gap-1.5` handles all icon spacing.

---

## Component 5: DetailField

**Problem it solves:** Every detail page displays label + value pairs. Currently each page creates a local helper function (commitments has `F()`, others use inline divs) with different text sizes, spacing, and empty state handling.

**Location:** `frontend/src/components/ds/detail-field.tsx`

**API:**
```tsx
interface DetailFieldProps {
  label: string;
  children?: React.ReactNode;
  /** Render as currency. Formats number with $ and commas */
  currency?: boolean;
  /** Render as date. Formats ISO string */
  date?: boolean;
  /** Span multiple columns in a grid */
  span?: 1 | 2 | 3;
  className?: string;
}
```

**Visual spec:**
- Label: `text-xs text-muted-foreground` (Eyebrow tier)
- Value: `mt-0.5 text-sm text-foreground`
- Empty: `<span className="text-muted-foreground/50">—</span>`
- Container: `min-w-0` (prevents overflow in grids)

**Usage:**
```tsx
<div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
  <DetailField label="Contract Number">{contract.number}</DetailField>
  <DetailField label="Amount" currency>{contract.amount}</DetailField>
  <DetailField label="Start Date" date>{contract.start_date}</DetailField>
  <DetailField label="Description" span={3}>{contract.description}</DetailField>
</div>
```

---

## Component 6: DetailFieldGrid

**Problem it solves:** The grid layout for detail fields varies across pages (different column counts, gaps, responsive breakpoints).

**Location:** `frontend/src/components/ds/detail-field.tsx` (same file as DetailField)

**API:**
```tsx
interface DetailFieldGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;  // Default: 3
  className?: string;
}
```

**Visual spec:**
- Default: `grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3`
- Columns=2: `sm:grid-cols-2` (no lg breakpoint)
- Columns=4: `sm:grid-cols-2 lg:grid-cols-4`

---

## Component 7: ConfirmDeleteDialog

**Problem it solves:** Delete confirmation dialogs appear on 11+ pages, each with slightly different wording, button styles, and behavior. Some use AlertDialog, some use Dialog, some use window.confirm().

**Location:** `frontend/src/components/ds/confirm-delete-dialog.tsx`

**API:**
```tsx
interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;         // Default: "Delete {entityName}?"
  description?: string;   // Default: "This action cannot be undone."
  entityName?: string;    // e.g., "contract", "line item"
  isDeleting?: boolean;
}
```

**Visual spec:**
- Uses `AlertDialog` from shadcn (not Dialog)
- Title: `text-lg font-semibold`
- Description: `text-sm text-muted-foreground`
- Cancel: `<Button variant="outline">Cancel</Button>`
- Confirm: `<Button variant="destructive" disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button>`
- Buttons: right-aligned with `gap-2`

---

## Component 8: BackButton

**Problem it solves:** Back navigation appears on form pages, detail pages, and sub-pages. Some use ghost buttons, some use outline, some add "Back" text, some don't. PageShell has `onBack` but not all pages use PageShell yet.

**Location:** `frontend/src/components/ds/back-button.tsx`

**API:**
```tsx
interface BackButtonProps {
  onClick?: () => void;    // Default: router.back()
  label?: string;          // Default: "Back"
  href?: string;           // If provided, uses Link instead of button
}
```

**Visual spec:**
- `<Button variant="ghost" size="sm"><ArrowLeft /> {label}</Button>`
- Uses router.back() by default
- Icon spacing handled by Button's built-in gap (no manual mr-2)

---

## Component 9: PageShell tabs integration

**Problem it solves:** PageShell has no concept of tabs. Every tabbed page manually inserts PageTabs between the header and content, with inconsistent padding and spacing.

**Location:** Modify existing `frontend/src/components/layout/page-shell.tsx`

**New props on PageShell:**
```tsx
interface PageShellProps {
  // ... existing props ...

  /** Tab configuration. When provided, renders PageTabs below the header. */
  tabs?: {
    items: { label: string; href: string; isActive?: boolean; count?: number }[];
    /** For local-state tab switching (detail pages). When omitted, uses URL navigation. */
    onTabClick?: (href: string) => void;
  };
}
```

**Behavior:**
- When `tabs` is provided, PageShell renders `<PageTabs>` between the header and content
- PageTabs inherits padding from PageContainer (NO independent padding)
- For `variant="detail"`: tabs render inside the max-width constraint
- For `variant="table"`: tabs render full-width

**Critical fix:** PageTabs must stop setting its own `px-4 sm:px-6 lg:px-8`. When rendered inside PageShell, it inherits the container's padding. The current padding mismatch (PageTabs: px-4/px-6/px-8 vs PageContainer: px-3/px-5/px-7) is a root cause of alignment issues.

---

## Component 10: InfoAlert

**Problem it solves:** Informational messages in pages (e.g., "No line items yet", "Budget is locked") are rendered with inconsistent styling — some use Alert, some use plain divs with bg-blue-50, some use cards.

**Location:** `frontend/src/components/ds/info-alert.tsx`

**API:**
```tsx
interface InfoAlertProps {
  children: React.ReactNode;
  variant?: "info" | "warning" | "success" | "error";
  icon?: React.ReactNode;
  className?: string;
}
```

**Visual spec:**
- Uses semantic background: `bg-blue-50` (info), `bg-yellow-50` (warning), `bg-green-50` (success), `bg-red-50` (error)
- Text: matching foreground color (`text-blue-600`, etc.)
- Icon: defaults per variant (Info, AlertTriangle, CheckCircle, XCircle)
- Padding: `p-3`
- Border radius: `rounded-md`
- NO border (tonal elevation only)

---

## Rules for Building These Components

1. **Import path:** All new components live in `@/components/ds/` and are exported from `@/components/ds/index.ts`
2. **Use existing primitives:** Build on Button, Card, Dialog, etc. from `@/components/ui/`. Never recreate primitives.
3. **Use design tokens:** Only semantic colors (`bg-card`, `text-muted-foreground`, `border-border`). Zero hex codes. Zero `gray-*` classes.
4. **Size tiers must match:** If a component contains multiple buttons, they MUST all use the same size tier. `size="sm"` text buttons pair with `size="icon-sm"` icon buttons (both 32px).
5. **No manual icon spacing:** Icons inside Button are auto-sized and auto-spaced. Never add `h-4 w-4`, `mr-2`, or `ml-2` to icons inside Button.
6. **Tooltips on icon-only buttons:** Every `size="icon-*"` button must have a Tooltip explaining the action.
7. **Props over classes:** If it can be a prop, make it a prop. Don't force consumers to pass className for common variations.
8. **Empty state handling:** Every component that displays data must handle the empty/null case gracefully (show `—` or EmptyState).
9. **TypeScript:** All props explicitly typed with JSDoc descriptions. Export prop types.
10. **Testing:** Each component should work in isolation. No dependency on page-level context (except useRouter for BackButton).

---

## Migration Priority

After building these components, migrate existing pages in this order:

1. **DetailActions** — Replace hand-rolled action buttons on all 8+ detail pages
2. **DetailField + DetailFieldGrid** — Replace local `F()` helpers and inline label/value divs
3. **FormActions** — Replace hand-rolled cancel/save on all form pages
4. **ConfirmDeleteDialog** — Replace 11+ delete confirmation implementations
5. **PageShell tabs** — Fix tab alignment, then migrate all tabbed pages
6. **EditModeActions** — Replace view/edit toggle patterns on 6+ pages
7. **SplitButton** — Replace broken split buttons
8. **BackButton** — Standardize back navigation
9. **InfoAlert** — Standardize informational messages
