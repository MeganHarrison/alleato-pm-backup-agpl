# Create Component (Design System Enforced)

Create a new component that follows design system rules.

## Usage
```
/component ComponentName [type]
```

**Types:**
- `ui` - Base UI component (goes in components/ui/)
- `form` - Form field component (goes in components/forms/)
- `layout` - Layout component (goes in components/layout/)
- `domain` - Domain-specific component (specify subdirectory)
- `page` - Page component

## Instructions

You are creating a new component. The component name is: $ARGUMENTS

### Step 1: Read Design System Rules
First, read `.claude/design-audit/design-system-rules.md` to understand the rules.

### Step 2: Determine Component Type and Location
Based on the name and context, determine:
- Component type (ui, form, layout, domain, page)
- File location
- Whether similar components exist to reference

### Step 3: Create Component Following Rules

**Color Rules:**
- Use semantic tokens: `text-foreground`, `text-muted-foreground`, `bg-background`, `bg-card`
- Status colors: `text-status-success`, `text-destructive`, etc.
- Brand color: `text-brand`, `bg-brand`
- NEVER use raw hex values or hardcoded Tailwind colors like `text-gray-500`

**Spacing Rules:**
- Use 8px grid: `p-2`, `p-4`, `p-6`, `p-8`, `gap-2`, `gap-4`, etc.
- NEVER use `p-3`, `p-5`, `p-7`, `gap-1.5`, `gap-2.5`, etc.
- NEVER use arbitrary values like `p-[10px]`

**Typography Rules:**
- Use scale: `text-xs`, `text-sm`, `text-base`, `text-lg`, etc.
- NEVER use arbitrary values like `text-[14px]`
- Use design system classes: `.text-card-title`, `.text-metric-sm`, etc.

**Border Radius Rules:**
- Use: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-full`
- NEVER use arbitrary values like `rounded-[8px]`

**Component Usage Rules:**
- Use ShadCN components where available (Button, Input, Card, Badge, etc.)
- Use form field wrappers (TextField, SelectField, etc.) for forms
- Use Card component instead of manual card styling

**Responsive Rules:**
- Mobile-first: Start with mobile styles, add `sm:`, `md:`, `lg:` breakpoints
- Always consider mobile experience

**Accessibility Rules:**
- Use proper ARIA attributes
- Ensure focus states are visible
- Associate labels with inputs

### Step 4: Verify Component
After creating the component:
1. Run `/design-check path/to/new/component.tsx`
2. Fix any violations found
3. Ensure TypeScript has no errors: `npm run typecheck --prefix frontend`

### Step 5: Document Component
Add a brief comment at the top of the file:
```tsx
/**
 * ComponentName
 *
 * [Brief description of what it does]
 *
 * @example
 * <ComponentName prop="value" />
 */
```

### Template: UI Component
```tsx
import { cn } from "@/lib/utils"

interface ComponentNameProps {
  className?: string
  children?: React.ReactNode
}

export function ComponentName({ className, children }: ComponentNameProps) {
  return (
    <div className={cn(
      "bg-card text-card-foreground p-4 rounded-lg border",
      className
    )}>
      {children}
    </div>
  )
}
```

### Template: Form Field Component
```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FieldNameProps {
  label: string
  name: string
  value?: string
  onChange?: (value: string) => void
  error?: string
  disabled?: boolean
  className?: string
}

export function FieldName({
  label,
  name,
  value,
  onChange,
  error,
  disabled,
  className
}: FieldNameProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label
        htmlFor={name}
        className="text-xs font-semibold text-neutral-500"
      >
        {label}
      </Label>
      <Input
        id={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <p id={`${name}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
```
