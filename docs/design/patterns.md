# UI Patterns

Standard patterns for common UI situations. Copy these, don't reinvent them.

## Loading States

### Page Loading (Skeleton)

```tsx
import { Skeleton } from "@/components/ui/skeleton";

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />        {/* Title */}
      <Skeleton className="h-4 w-96" />        {/* Description */}
      <div className="space-y-2 mt-8">
        <Skeleton className="h-12 w-full" />   {/* Table row */}
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
```

### Inline Loading (Spinner)

```tsx
import { Loader2 } from "lucide-react";

<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
```

### Button Loading

```tsx
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
  Save Changes
</Button>
```

## Error States

### Page-Level Error

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function ErrorState({ error }: { error: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
```

### Inline Error (Forms)

Handled automatically by `FormMessage` in react-hook-form.

### Toast Errors

```tsx
import { toast } from "sonner";

toast.error("Failed to save changes");
toast.success("Changes saved");
```

## Empty States

### Table Empty State

```tsx
function EmptyTable({ title, description, action }: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-lg font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Usage:
<EmptyTable
  title="No commitments yet"
  description="Create your first commitment to start tracking subcontracts."
  action={<Button><Plus className="h-4 w-4" /> New Commitment</Button>}
/>
```

### Page Empty State (with illustration)

For first-time experiences where more visual impact helps:

```tsx
function EmptyPage({ icon: Icon, title, description, action }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">{description}</p>
      <div className="mt-6">{action}</div>
    </div>
  );
}
```

## Data Fetching Pattern

Standard React Query loading/error/success flow:

```tsx
const { data, isLoading, error } = useItems(projectId);

if (isLoading) return <PageSkeleton />;
if (error) return <ErrorState error={error.message} />;
if (!data?.length) return <EmptyTable title="No items" description="..." />;

return <ItemsTable data={data} />;
```

**Always handle all three states. Never skip error or empty.**

## Form Patterns

### Form Section

```tsx
<section className="space-y-6">
  <div className="border-b pb-2">
    <h2 className="text-lg font-semibold">Section Title</h2>
    <p className="text-sm text-muted-foreground">Section description</p>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* FormFields here */}
  </div>
</section>
```

### Form Actions (always at form bottom)

```tsx
<div className="flex items-center justify-end gap-4 pt-6 border-t">
  <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
    Cancel
  </Button>
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
    Save
  </Button>
</div>
```

### Select with Optional Field

Radix Select does NOT allow empty string values. For optional selects:

```tsx
// Don't add a "None" SelectItem. Just use placeholder:
<Select onValueChange={field.onChange} defaultValue={field.value}>
  <SelectTrigger>
    <SelectValue placeholder="Select option (optional)" />
  </SelectTrigger>
  <SelectContent>
    {options.map((opt) => (
      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Options as Constants

```tsx
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
] as const;
```

## Confirmation Dialogs

```tsx
import {
  Modal, ModalContent, ModalHeader, ModalTitle,
  ModalDescription, ModalFooter,
} from "@/components/ui/unified-modal";

function DeleteConfirmation({ open, onOpenChange, onConfirm, itemName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  itemName: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="sm">
        <ModalHeader>
          <ModalTitle>Delete {itemName}?</ModalTitle>
          <ModalDescription>
            This action cannot be undone. This will permanently delete the item.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
```

## Detail Side Panel

```tsx
import {
  Slideover, SlideoverContent, SlideoverHeader,
  SlideoverTitle, SlideoverBody, SlideoverFooter,
} from "@/components/ui/unified-slideover";

function DetailPanel({ open, onOpenChange, item }: Props) {
  return (
    <Slideover open={open} onOpenChange={onOpenChange}>
      <SlideoverContent side="right" size="lg">
        <SlideoverHeader>
          <SlideoverTitle>{item.name}</SlideoverTitle>
        </SlideoverHeader>
        <SlideoverBody>
          {/* Detail content */}
        </SlideoverBody>
        <SlideoverFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button>Edit</Button>
        </SlideoverFooter>
      </SlideoverContent>
    </Slideover>
  );
}
```

## Page Section Headers

Use these consistently. Not cards. Not custom wrappers.

```tsx
{/* Section with description */}
<section className="space-y-4">
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-lg font-semibold text-foreground">Section Title</h2>
      <p className="text-sm text-muted-foreground">Optional description</p>
    </div>
    <Button size="sm" variant="outline">Action</Button>
  </div>
  {/* Section content */}
</section>

{/* Simple section */}
<section className="space-y-4">
  <h2 className="text-lg font-semibold text-foreground">Section Title</h2>
  {/* Section content */}
</section>
```

## Status Badges

```tsx
import { Badge } from "@/components/ui/badge";

// Variants map to status:
<Badge variant="default">Active</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Overdue</Badge>
<Badge variant="outline">Pending</Badge>
```

## Responsive Patterns

### Hide on Mobile

```tsx
<div className="hidden md:block">{/* Desktop only */}</div>
<div className="md:hidden">{/* Mobile only */}</div>
```

### Stack to Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Stacks on mobile, grid on larger */}
</div>
```

### Table Overflow

```tsx
<div className="overflow-x-auto">
  <Table>{/* ... */}</Table>
</div>
```
