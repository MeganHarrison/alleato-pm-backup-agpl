# Form System Documentation

## Overview

This project uses a **structured form system** built on:

- **React Hook Form** — form state management
- **Zod** — schema validation
- **shadcn/ui primitives** — UI building blocks (`@/components/ui/`)
- **Custom form abstractions** — `@/components/forms/`

The system provides **four layers**:

1. **Shadcn UI primitives** — raw inputs, selects, checkboxes
2. **Standalone field components** — self-contained fields with label/error wrappers (no RHF dependency)
3. **RHF field wrappers** — typed generic components wired to React Hook Form's `Controller`
4. **Layout components** — sections, grids, actions, error display

All components are importable from a single barrel:

```tsx
import { FormSection, FormGrid, RHFTextField, TextField, buildOptions } from "@/components/forms"
```

---

## Directory Structure

```
frontend/src/components/
  forms/
    fields/                          # RHF-wired field wrappers
      RHFTextField.tsx
      RHFTextareaField.tsx
      RHFSelectField.tsx
      RHFNumberField.tsx
      RHFCheckboxField.tsx
      RHFDateField.tsx
      RHFMoneyField.tsx
      RHFComboboxField.tsx
      RHFFieldArrayTable.tsx
      index.ts

    utils/                           # Shared utilities
      buildOptions.ts
      parsers.ts
      index.ts

    # Layout components
    Form.tsx
    FormSection.tsx
    FormGrid.tsx
    FormGridRow.tsx
    FormField.tsx
    FormActions.tsx
    FormServerError.tsx
    FormTotalRow.tsx

    # Standalone field components
    TextField.tsx
    TextareaField.tsx
    SelectField.tsx
    MultiSelectField.tsx
    DateField.tsx
    NumberField.tsx
    MoneyField.tsx
    AutocompleteField.tsx
    CheckboxField.tsx
    ToggleField.tsx
    RichTextField.tsx
    FileUploadField.tsx
    SearchableSelect.tsx
    EntitySelect.tsx

    index.ts                         # Barrel export
```

---

## Layer 1: Shadcn UI Primitives

These live in `frontend/src/components/ui/` and are **pure UI primitives** with no business logic or form state.

| Component | File | Notes |
|-----------|------|-------|
| Form / FormField / FormItem / FormLabel / FormControl / FormMessage | [form.tsx](frontend/src/components/ui/form.tsx) | RHF `FormProvider` re-export + context-aware wrappers |
| Input | [input.tsx](frontend/src/components/ui/input.tsx) | `variant`: `"default"` \| `"inline"` (borderless) |
| Textarea | [textarea.tsx](frontend/src/components/ui/textarea.tsx) | Auto-resize via `field-sizing-content` |
| Select / SelectTrigger / SelectContent / SelectItem | [select.tsx](frontend/src/components/ui/select.tsx) | Radix Select with `size` and `variant` props |
| Checkbox | [checkbox.tsx](frontend/src/components/ui/checkbox.tsx) | Radix Checkbox |
| Switch | [switch.tsx](frontend/src/components/ui/switch.tsx) | Used by `ToggleField` |
| Calendar | [calendar.tsx](frontend/src/components/ui/calendar.tsx) | Used by date pickers |
| Popover | [popover.tsx](frontend/src/components/ui/popover.tsx) | Used by combobox/date/autocomplete |
| Command | [command.tsx](frontend/src/components/ui/command.tsx) | cmdk-based, used by searchable selects |
| InputGroup / InputGroupAddon / InputGroupInput | [input-group.tsx](frontend/src/components/ui/input-group.tsx) | Prefix/suffix layout, used by `RHFMoneyField` |

---

## Layer 2: Layout Components

### Form

> [Form.tsx](frontend/src/components/forms/Form.tsx)

Top-level form wrapper that provides density context to all children.

```tsx
interface FormProps {
  children: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
  density?: "comfortable" | "default" | "compact"  // default: "comfortable"
}
```

Density controls vertical spacing between sections:
- `comfortable` → `space-y-8`
- `default` → `space-y-6`
- `compact` → `space-y-4`

Also exports `useFormDensity()` hook and `FormDensity` type.

---

### FormSection

> [FormSection.tsx](frontend/src/components/forms/FormSection.tsx)

Groups related fields with a title and optional description.

```tsx
interface FormSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode    // Slot for section-level actions (right-aligned)
  className?: string
}
```

Renders a `<section>` with bottom border (removed on last child via `last:border-b-0`).

---

### FormGrid

> [FormGrid.tsx](frontend/src/components/forms/FormGrid.tsx)

Responsive grid layout for fields. Mobile-first — always 1 column on small screens.

```tsx
interface FormGridProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3 | 12    // default: 1
  className?: string
}
```

- `columns={12}` enables a 12-column CSS grid for manual `col-span-*` control on children
- Use with `FormGridRow` for advanced layouts

---

### FormGridRow

> [FormGridRow.tsx](frontend/src/components/forms/FormGridRow.tsx)

A row within a 12-column `FormGrid`. Spans `col-span-12`, switches to `grid-cols-12` at `md` breakpoint.

```tsx
interface FormGridRowProps {
  children: React.ReactNode
  className?: string
  gap?: FormDensity           // Overrides parent density context
  align?: "start" | "center"
}
```

---

### FormField

> [FormField.tsx](frontend/src/components/forms/FormField.tsx)

Standalone label + error wrapper. Used internally by all standalone field components. **Not** the same as shadcn's `FormField` from `ui/form.tsx`.

```tsx
interface FormFieldProps {
  label: React.ReactNode
  children: React.ReactNode
  error?: string
  hint?: string
  required?: boolean
  className?: string
  fullWidth?: boolean          // Adds sm:col-span-2
}
```

---

### FormActions

> [FormActions.tsx](frontend/src/components/forms/FormActions.tsx)

Standardized submit/cancel action bar.

```tsx
interface FormActionsProps {
  submitLabel: string
  cancelLabel?: string         // default: "Cancel"
  onCancel?: () => void
  isSubmitting?: boolean
  submitDisabled?: boolean
  cancelDisabled?: boolean
  align?: "start" | "end" | "between"  // default: "end"
  stickyOnMobile?: boolean     // default: true
  children?: React.ReactNode
  className?: string
}
```

Behavior:
- **Mobile:** Sticky bottom bar with backdrop-blur, safe-area padding, full-width stacked buttons
- **Desktop:** Static inline row
- Shows `<Loader2 /> Saving...` during `isSubmitting`
- Cancel button only renders when `onCancel` is provided

---

### FormServerError

> [FormServerError.tsx](frontend/src/components/forms/FormServerError.tsx)

Displays API-level or server errors with `role="alert"`.

```tsx
interface FormServerErrorProps {
  message?: string
}
```

Returns `null` when `message` is falsy. Renders destructive border/background.

**Note:** Not currently in the barrel export — import directly:
```tsx
import { FormServerError } from "@/components/forms/FormServerError"
```

---

### FormTotalRow

> [FormTotalRow.tsx](frontend/src/components/forms/FormTotalRow.tsx)

Summary row for financial forms (e.g., line item totals).

```tsx
interface FormTotalRowProps {
  label: string
  value: React.ReactNode
  className?: string
}
```

Renders top border, label left, value right with `tabular-nums font-semibold`.

---

## Layer 3: Standalone Field Components

Self-contained fields that wrap the `FormField` label/error container. These do **not** require React Hook Form — they accept `value`/`onChange` directly and can be used in any context.

All are importable from `@/components/forms`.

### TextField

> [TextField.tsx](frontend/src/components/forms/TextField.tsx)

```tsx
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
}
```

Always renders `type="text"`. Auto-generates `id` from label slug.

---

### TextareaField

> [TextareaField.tsx](frontend/src/components/forms/TextareaField.tsx)

```tsx
interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
}
```

---

### SelectField

> [SelectField.tsx](frontend/src/components/forms/SelectField.tsx)

```tsx
interface SelectFieldProps {
  label: string
  options: { value: string; label: string }[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  dataTestId?: string
}
```

---

### MultiSelectField

> [MultiSelectField.tsx](frontend/src/components/forms/MultiSelectField.tsx)

Multi-value select using `Command` + `Popover` (cmdk-based). Selected values render as `<Badge>` chips.

```tsx
interface MultiSelectFieldProps {
  label: string
  options: { value: string; label: string }[]
  value?: string[]
  onChange?: (values: string[]) => void
  placeholder?: string
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
}
```

---

### DateField

> [DateField.tsx](frontend/src/components/forms/DateField.tsx)

Calendar popover date picker using `date-fns` for formatting.

```tsx
interface DateFieldProps {
  label: string
  value?: Date
  onChange?: (date: Date | undefined) => void
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  placeholder?: string
}
```

---

### NumberField

> [NumberField.tsx](frontend/src/components/forms/NumberField.tsx)

Numeric input with parsed `number` output. Supports prefix/suffix overlays.

```tsx
interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: string
  value?: number
  onChange?: (value: number | undefined) => void
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  prefix?: string              // e.g., "$"
  suffix?: string              // e.g., "sq ft"
}
```

`onChange` receives a parsed `number` (or `undefined` for empty/NaN), not a raw event.

---

### MoneyField

> [MoneyField.tsx](frontend/src/components/forms/MoneyField.tsx)

Currency-formatted input with focus/blur formatting behavior.

```tsx
interface MoneyFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: string
  value?: number
  onChange?: (value: number | undefined) => void
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  currency?: string            // default: "USD"
  showCurrency?: boolean       // default: true
}
```

- On focus: shows raw number, auto-selects text
- On blur: formats with `toLocaleString("en-US", { minimumFractionDigits: 2 })`
- Always shows `$` prefix; shows currency suffix when enabled

---

### AutocompleteField

> [AutocompleteField.tsx](frontend/src/components/forms/AutocompleteField.tsx)

Searchable dropdown with optional description sub-text and clearable selection.

```tsx
interface AutocompleteFieldProps {
  label: string
  options: { value: string; label: string; description?: string }[]
  value?: string
  onValueChange?: (value: string | undefined) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  clearable?: boolean          // default: true
  loading?: boolean
  onSearch?: (search: string) => void
}
```

---

### CheckboxField

> [CheckboxField.tsx](frontend/src/components/forms/CheckboxField.tsx)

```tsx
interface CheckboxFieldProps {
  label: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  error?: string
  hint?: string
  disabled?: boolean
}
```

---

### ToggleField

> [ToggleField.tsx](frontend/src/components/forms/ToggleField.tsx)

Switch toggle with label/hint on the left, `<Switch>` on the right.

```tsx
interface ToggleFieldProps {
  label: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  error?: string
  hint?: string
  disabled?: boolean
}
```

---

### RichTextField

> [RichTextField.tsx](frontend/src/components/forms/RichTextField.tsx)

Simple rich text editor using `contentEditable` with toolbar (bold, italic, underline, lists).

```tsx
interface RichTextFieldProps {
  label: string
  value?: string
  onChange?: (value: string) => void
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  placeholder?: string
}
```

Uses `document.execCommand()` for formatting. `onChange` receives `innerHTML`.

---

### FileUploadField

> [FileUploadField.tsx](frontend/src/components/forms/FileUploadField.tsx)

Drag-and-drop file upload with size validation and two visual variants.

```tsx
interface FileUploadFieldProps {
  label: React.ReactNode
  value?: FileInfo[]           // { name, size, type, url? }[]
  onChange?: (files: FileInfo[]) => void
  onFilesSelected?: (files: File[]) => void  // Raw File objects
  accept?: string
  multiple?: boolean
  maxFiles?: number            // default: 10
  maxSize?: number             // default: 10MB (bytes)
  error?: string
  hint?: string
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  variant?: "default" | "minimal"
  showMetaText?: boolean       // default: true
  dropzoneTestId?: string
  inputTestId?: string
  fileListTestId?: string
}
```

- `"default"` variant: large centered dropzone with icon
- `"minimal"` variant: compact inline row with "Choose Files" button
- Two callbacks: `onFilesSelected` (raw `File[]`), `onChange` (`FileInfo[]` metadata)

---

### SearchableSelect

> [SearchableSelect.tsx](frontend/src/components/forms/SearchableSelect.tsx)

Searchable select with "Create New" footer support. Does **not** use `FormField` wrapper — manages its own label.

```tsx
interface SearchableSelectProps {
  label?: string
  options: { value: string; label: string; description?: string }[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  required?: boolean
  className?: string
  triggerClassName?: string
  addButton?: React.ReactNode  // External button slot (right of trigger)
  onCreateNew?: () => void
  createNewLabel?: string      // default: "+ Create New"
  triggerTestId?: string
  optionTestIdPrefix?: string
  searchInputTestId?: string
}
```

**Note:** Not currently in the barrel export — import directly:
```tsx
import { SearchableSelect } from "@/components/forms/SearchableSelect"
```

---

### EntitySelect

> [EntitySelect.tsx](frontend/src/components/forms/EntitySelect.tsx)

Purpose-built for FK relationship selects (e.g., selecting a company or user by UUID).

```tsx
interface EntitySelectProps {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  isLoading?: boolean
  placeholder?: string
  error?: string
  disabled?: boolean
  id?: string
  emptyMessage?: string        // default: "No options available"
}
```

Shows `<Loader2 /> Loading...` and disables during `isLoading`.

**Note:** Not currently in the barrel export — import directly:
```tsx
import { EntitySelect } from "@/components/forms/EntitySelect"
```

---

## Layer 4: RHF Field Wrappers

These components integrate directly with React Hook Form via typed generics. They accept `control` and `name` props and handle all wiring to `FormField` / `FormItem` / `FormLabel` / `FormMessage` from `@/components/ui/form`.

**Use these when your form uses `useForm()` from React Hook Form.**

All are importable from `@/components/forms`.

### RHFTextField

> [RHFTextField.tsx](frontend/src/components/forms/fields/RHFTextField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `placeholder` | `string` | — |
| `description` | `string` | — |
| `type` | `string` | — |
| `autoComplete` | `string` | — |
| `disabled` | `boolean` | — |

**Note:** Not in `fields/index.ts` but exported from the top-level barrel (`@/components/forms`).

---

### RHFTextareaField

> [RHFTextareaField.tsx](frontend/src/components/forms/fields/RHFTextareaField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `placeholder` | `string` | — |
| `description` | `string` | — |
| `rows` | `number` | `4` |
| `disabled` | `boolean` | — |

---

### RHFSelectField

> [RHFSelectField.tsx](frontend/src/components/forms/fields/RHFSelectField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `options` | `{ value: string; label: string }[]` | required |
| `placeholder` | `string` | — |
| `description` | `string` | — |
| `disabled` | `boolean` | — |

Also exports `SelectOption` interface.

---

### RHFNumberField

> [RHFNumberField.tsx](frontend/src/components/forms/fields/RHFNumberField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `placeholder` | `string` | — |
| `description` | `string` | — |
| `min` | `number` | — |
| `max` | `number` | — |
| `step` | `number` | `1` |
| `disabled` | `boolean` | — |

**Note:** Passes `e.target.value` as string to `field.onChange` — use Zod `z.preprocess(parseOptionalNumber, ...)` for numeric validation.

---

### RHFMoneyField

> [RHFMoneyField.tsx](frontend/src/components/forms/fields/RHFMoneyField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `placeholder` | `string` | `"0.00"` |
| `description` | `string` | — |
| `min` | `number` | — |
| `max` | `number` | — |
| `step` | `number` | `0.01` |
| `currencySymbol` | `string` | `"$"` |
| `disabled` | `boolean` | — |

Uses `InputGroup` / `InputGroupAddon` from `@/components/ui/input-group` for the currency prefix.

---

### RHFCheckboxField

> [RHFCheckboxField.tsx](frontend/src/components/forms/fields/RHFCheckboxField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `description` | `string` | — |
| `disabled` | `boolean` | — |

Layout: checkbox left, label/description stacked to the right.

---

### RHFDateField

> [RHFDateField.tsx](frontend/src/components/forms/fields/RHFDateField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `placeholder` | `string` | — |
| `description` | `string` | — |
| `disabled` | `boolean` | — |
| `nullable` | `boolean` | `false` |
| `valueType` | `"date"` \| `"string"` | `"string"` |

Responsive behavior:
- **Mobile** (`useIsMobile()`): renders calendar inside a `Drawer` (bottom sheet)
- **Desktop:** renders inside a `Popover`

`valueType="string"` stores `"yyyy-MM-dd"` format. `nullable=true` shows a "Clear date" button.

---

### RHFComboboxField

> [RHFComboboxField.tsx](frontend/src/components/forms/fields/RHFComboboxField.tsx)

| Prop | Type | Default |
|------|------|---------|
| `control` | `Control<TFieldValues>` | required |
| `name` | `FieldPath<TFieldValues>` | required |
| `label` | `string` | required |
| `options` | `{ value: string; label: string; keywords?: string[] }[]` | required |
| `placeholder` | `string` | — |
| `searchPlaceholder` | `string` | — |
| `emptyMessage` | `string` | — |
| `description` | `string` | — |
| `disabled` | `boolean` | — |

Also exports `ComboboxOption` interface.

Responsive behavior:
- **Mobile:** `Drawer` (bottom sheet)
- **Desktop:** `Popover`

`keywords` array allows extra searchable terms per option (searched alongside label + value).

---

### RHFFieldArrayTable

> [RHFFieldArrayTable.tsx](frontend/src/components/forms/fields/RHFFieldArrayTable.tsx)

Editable row table powered by RHF's `useFieldArray`.

```tsx
interface Props<TFieldValues, TName extends FieldArrayPath<TFieldValues>> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  columns: Column[]            // { key, header, mobileLabel?, className?, cell(index, rowName) }
  createRow: () => FieldArray<TFieldValues, TName>
  addLabel?: string            // default: "Add Row"
  minRows?: number             // default: 1
}
```

- `minRows` is enforced via `useEffect` — auto-appends rows if array falls below minimum
- Delete button is disabled at `minRows`
- **Mobile:** stacked card layout per row with `mobileLabel` per column
- **Desktop:** standard `<Table>` with delete icon in last column

---

## Utilities

### buildOptions

> [buildOptions.ts](frontend/src/components/forms/utils/buildOptions.ts)

Creates type-safe select option arrays from const string tuples.

```tsx
function buildOptions<const T extends readonly string[]>(
  values: T,
  labelMap?: Partial<Record<T[number], string>>
): { value: T[number]; label: string }[]
```

```tsx
const STATUS_VALUES = ["draft", "pending", "approved"] as const

const STATUS_OPTIONS = buildOptions(STATUS_VALUES, {
  draft: "Draft",
  pending: "Pending Review",
  approved: "Approved"
})
// → [{ value: "draft", label: "Draft" }, { value: "pending", label: "Pending Review" }, ...]
```

---

### parsers

> [parsers.ts](frontend/src/components/forms/utils/parsers.ts)

Handles numeric input parsing for Zod schemas (HTML inputs return strings).

| Function | Behavior |
|----------|----------|
| `parseOptionalNumber` | Returns `undefined` for empty/null/undefined/NaN. Accepts `unknown`. |
| `parseRequiredNumber` | Returns `undefined` only for NaN. Does not treat empty string as undefined. |

```tsx
const schema = z.object({
  amount: z.preprocess(parseOptionalNumber, z.number().min(0).optional())
})
```

---

## Barrel Export Reference

The barrel at [index.ts](frontend/src/components/forms/index.ts) exports the following:

**Layout:** `Form`, `FormSection`, `FormGrid`, `FormGridRow`, `FormTotalRow`, `FormActions`, `FormField`

**Standalone Fields:** `TextField`, `TextareaField`, `SelectField`, `MultiSelectField`, `DateField`, `NumberField`, `MoneyField`, `AutocompleteField`, `CheckboxField`, `ToggleField`, `RichTextField`, `FileUploadField`

**RHF Fields:** `RHFTextareaField`, `RHFSelectField`, `RHFNumberField`, `RHFCheckboxField`, `RHFDateField`, `RHFMoneyField`, `RHFComboboxField`, `RHFFieldArrayTable`

**Utilities:** `buildOptions`, `parseOptionalNumber`, `parseRequiredNumber`

**Not in barrel (import directly):**

| Component | Direct Import |
|-----------|---------------|
| `FormServerError` | `import { FormServerError } from "@/components/forms/FormServerError"` |
| `SearchableSelect` | `import { SearchableSelect } from "@/components/forms/SearchableSelect"` |
| `EntitySelect` | `import { EntitySelect } from "@/components/forms/EntitySelect"` |
| `RHFTextField` | `import { RHFTextField } from "@/components/forms/fields/RHFTextField"` |

---

## Standard Form Pattern

### With React Hook Form (recommended for most forms)

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form as RHFForm } from "@/components/ui/form"
import {
  Form,
  FormSection,
  FormGrid,
  FormActions,
  RHFTextField,
  RHFSelectField,
  RHFMoneyField,
  buildOptions,
} from "@/components/forms"
import { FormServerError } from "@/components/forms/FormServerError"

const TYPE_OPTIONS = buildOptions(["standard", "custom"] as const, {
  standard: "Standard",
  custom: "Custom",
})

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  amount: z.preprocess(parseOptionalNumber, z.number().min(0).optional()),
})

function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: "", type: "", amount: undefined },
  })

  const { control, handleSubmit, formState: { isSubmitting, errors } } = form

  return (
    <RHFForm {...form}>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <FormSection title="Basic Information" description="Enter the main details">
          <FormGrid columns={2}>
            <RHFTextField control={control} name="name" label="Name" />
            <RHFSelectField control={control} name="type" label="Type" options={TYPE_OPTIONS} />
            <RHFMoneyField control={control} name="amount" label="Amount" />
          </FormGrid>
        </FormSection>

        <FormServerError message={errors.root?.message} />
        <FormActions submitLabel="Create" isSubmitting={isSubmitting} onCancel={handleCancel} />
      </Form>
    </RHFForm>
  )
}
```

### Without React Hook Form (simple forms)

```tsx
import { Form, FormSection, FormGrid, FormActions, TextField, SelectField } from "@/components/forms"

function SimpleForm() {
  const [name, setName] = useState("")
  const [type, setType] = useState("")

  return (
    <Form onSubmit={handleSubmit}>
      <FormSection title="Details">
        <FormGrid columns={2}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <SelectField label="Type" value={type} onValueChange={setType} options={TYPE_OPTIONS} />
        </FormGrid>
      </FormSection>
      <FormActions submitLabel="Save" onCancel={handleCancel} />
    </Form>
  )
}
```

---

## Mobile Behavior

The form system includes built-in mobile-safe behavior:

| Component | Desktop | Mobile |
|-----------|---------|--------|
| `FormGrid` | Multi-column based on `columns` prop | Always 1 column |
| `RHFComboboxField` | Popover dropdown | Bottom drawer |
| `RHFDateField` | Popover with calendar | Bottom drawer with calendar |
| `RHFFieldArrayTable` | Standard `<Table>` | Stacked card layout per row |
| `FormActions` | Static inline row | Sticky bottom bar, full-width buttons, backdrop-blur |

### Mobile checklist for new forms

1. Verify keyboard-safe action visibility (sticky `FormActions`)
2. Check touch target comfort at 375px width
3. Test long option lists in comboboxes and autocompletes
4. Verify field-array editing speed on mobile
5. Ensure `fullWidth` fields don't break grid on small screens

---

## Design Principles

| Principle | What it means |
|-----------|--------------|
| **Consistency** | All forms share the same structure, spacing, and component library |
| **Composability** | Pages assemble forms from reusable layout + field components |
| **Separation of concerns** | UI primitives, form state, and layout are independent layers |
| **Predictability** | Developers know exactly where every component lives |
| **AI-friendly** | Structured patterns allow AI agents to reliably generate correct forms |

---

## When to Use What

| Scenario | Use |
|----------|-----|
| Standard form with validation | RHF fields (`RHFTextField`, etc.) + Zod schema |
| Simple controlled form | Standalone fields (`TextField`, etc.) |
| FK relationship dropdown | `EntitySelect` (loading state, empty state built-in) |
| Searchable select with "Create New" | `SearchableSelect` |
| Multi-value selection | `MultiSelectField` |
| Editable line items / row table | `RHFFieldArrayTable` |
| File uploads | `FileUploadField` (`"default"` for dropzone, `"minimal"` for inline) |
| Rich text content | `RichTextField` |
| Boolean toggle with label | `ToggleField` (switch) or `CheckboxField` (checkbox) |
| Financial totals row | `FormTotalRow` |
| API error display | `FormServerError` |
| Type-safe select options | `buildOptions()` |
| Numeric Zod parsing | `parseOptionalNumber` / `parseRequiredNumber` |
