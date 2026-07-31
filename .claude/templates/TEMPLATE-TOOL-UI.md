---
title: UI {ToolName}
description: UI {ToolName} documentation
---

# {Tool Name} UI Components Specification

## Reality Notes

<!-- Document the ACTUAL state of the implementation vs. what the spec describes.
     Be honest about what works, what's broken, and what's missing. -->

- {Description of a data type mismatch, broken parameter handling, or similar issue}
- {Description of a dependency that doesn't work yet (e.g., child components relying on broken parent data)}
- {Description of a payload/schema mismatch between frontend and backend}
- {Description of any components wired to non-existent endpoints or using hardcoded data}

## Deliverables

1. {ToolName}ListPage
2. {ToolName}Form
   1. {ToolName}GeneralSection
   2. {ToolName}{DomainSection1} _(e.g., RevenueSection, PricingSection, DetailsSection)_
   3. {ToolName}{DomainSection2}Grid _(e.g., LineItemsGrid, TasksGrid, EntriesGrid)_
   4. {ToolName}AttachmentsSection
3. {ToolName}TableColumns
4. {ToolName}{WorkflowComponent} _(e.g., ApprovalWorkflow, StatusWorkflow)_
5. {ToolName}{ActionDialog} _(e.g., ConvertDialog, ExportDialog, ArchiveDialog)_

## Component Specifications

### 1. {ToolName}ListPage

**File**: `/frontend/src/app/[projectId]/{tool-slug}/page.tsx`
**Purpose**: Main list view with filtering, sorting, and data table
**Screenshot**: _{Reference to screenshot location}_

#### Props Interface

```typescript
interface {ToolName}ListPageProps {
  params: {
    projectId: string;
  };
  searchParams?: {
    status?: string;
    page?: string;
    sort?: string;
    search?: string;
  };
}
```

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                      │
├─────────────────────────────────────────────────────────────┤
│ {Tool Name}                [Search] [Create New] [Filter]   │
├─────────────────────────────────────────────────────────────┤
│ STATUS TABS                                                 │
│ [All] [{Status1}] [{Status2}] [{Status3}] [{StatusN}]      │
├─────────────────────────────────────────────────────────────┤
│ DATA TABLE                                                  │
│ # │ {Col1}          │ {Col2}  │ Status │ {Col4}  │ Actions │
├───┼─────────────────┼─────────┼────────┼─────────┼─────────┤
│001│{Sample Row 1}   │{Value}  │{Status}│{Amount} │⋯        │
│002│{Sample Row 2}   │{Value}  │{Status}│{Amount} │⋯        │
│003│{Sample Row 3}   │{Value}  │{Status}│{Amount} │⋯        │
├─────────────────────────────────────────────────────────────┤
│ PAGINATION                          [1] [2] [3] ... [N]     │
└─────────────────────────────────────────────────────────────┘
```

#### State Management

```typescript
interface ListPageState {
  items: {ToolName}Summary[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  filters: FilterState;
  selectedTab: StatusTab;
}
```

> ⚠️ Reality: _{Document any real discrepancies — e.g., routing issues, broken callbacks, data not loading. Delete this line if everything works.}_

### 2. {ToolName}Form

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}Form.tsx`
**Purpose**: Main form component for create/edit operations
**Screenshot**: _{Reference to screenshot location}_

#### Props Interface

```typescript
interface {ToolName}FormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<{ToolName}>;
  projectId: string;
  onSubmit: (data: {ToolName}FormData) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}
```

#### Layout Structure

```
┌─────────────────────────────────────────────┐
│ FORM HEADER                                 │
├─────────────────────────────────────────────┤
│ [{Tab1}] [{Tab2}] [{Tab3}] [{Tab4}]        │
├─────────────────────────────────────────────┤
│ ACTIVE TAB CONTENT                          │
│                                             │
│ [Conditional sections based on tab]         │
│                                             │
├─────────────────────────────────────────────┤
│ FORM ACTIONS                                │
│                   [Cancel] [Save] [Submit]   │
└─────────────────────────────────────────────┘
```

#### Component Architecture

```typescript
const {ToolName}Form = ({ mode, initialData, projectId, onSubmit, onCancel }: {ToolName}FormProps) => {
  const form = useForm<{ToolName}FormData>({
    resolver: zodResolver({toolName}Schema),
    defaultValues: initialData
  });

  // Conditional rendering based on form state
  const showOptionalSection = form.watch('{conditionalField}');

  return (
    <Form {...form}>
      <div className="space-y-6">
        <{ToolName}GeneralSection />
        {showOptionalSection && <{ToolName}{DomainSection1} />}
        <{ToolName}{DomainSection2}Grid />
        <{ToolName}AttachmentsSection />
      </div>
    </Form>
  );
};
```

> ⚠️ Reality: _{Document form state management discrepancies — e.g., uses own state vs React Hook Form, bypasses API, etc. Delete if accurate.}_

#### a. {ToolName}GeneralSection

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}GeneralSection.tsx`
**Purpose**: Basic {tool name} information fields
**Screenshot**: _{Reference to screenshot location}_

##### Props Interface

```typescript
interface {ToolName}GeneralSectionProps {
  data: Partial<{ToolName}FormData>;
  onChange: (updates: Partial<{ToolName}FormData>) => void;
  errors?: Partial<Record<keyof {ToolName}FormData, string>>;
  projectId: number;
}
```

##### Layout Structure

```
┌─────────────────────────────────────────────┐
│ GENERAL INFORMATION                         │
├─────────────────┬───────────────────────────┤
│ {Field1}        │ {Field2} *                │
│ [{auto/input}]  │ [_____________________]   │
├─────────────────┼───────────────────────────┤
│ {Field3} *      │ {Field4} *                │
│ [{Dropdown▼}]   │ [{Dropdown▼}]             │
├─────────────────┼───────────────────────────┤
│ {Field5} *      │ {Field6}                  │
│ [{Dropdown▼}]   │ [{Dropdown▼}]             │
├─────────────────┴───────────────────────────┤
│ {LongTextField}                             │
│ [Text area - {N} char limit]                │
│ 0/{N}                                       │
└─────────────────────────────────────────────┘
```

##### Field Dependencies

```typescript
// Example: {Field4} options depend on {Field3} selection
const dependentOptions = useMemo(() => {
  const optionMap: Record<string, string[]> = {
    '{Type1}': ['{Option1}', '{Option2}', '{Option3}'],
    '{Type2}': ['{Option4}', '{Option5}', '{Option6}'],
    '{Type3}': ['{Option7}', '{Option8}']
  };
  return optionMap[selectedType] || [];
}, [selectedType]);
```

#### b. {ToolName}{DomainSection1}

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}{DomainSection1}.tsx`
**Purpose**: {Domain-specific configuration section — e.g., revenue settings, pricing, scheduling}
**Screenshot**: _{Reference to screenshot location}_

##### Props Interface

```typescript
interface {ToolName}{DomainSection1}Props {
  data: Partial<{ToolName}FormData>;
  onChange: (updates: Partial<{ToolName}FormData>) => void;
  projectId: number;
}
```

##### Layout Structure

```
┌─────────────────────────────────────────────┐
│ {SECTION TITLE}                             │
├─────────────────────────────────────────────┤
│ ☑ {Toggle/Checkbox Label}                   │
├─────────────────────────────────────────────┤
│ {Dropdown Label} *                          │
│ [{Option ▼}]                                │
├─────────────────────────────────────────────┤
│ {Conditional Field Label}                   │
│ [{Conditional Option ▼}]                    │
└─────────────────────────────────────────────┘
```

##### Conditional Display Logic

```typescript
const {DomainSection1} = ({ form, visible }: Props) => {
  if (!visible) return null;

  const conditionalValue = form.watch('{fieldName}');
  const showConditionalField = conditionalValue === '{triggerValue}';

  return (
    <div className="space-y-4">
      <FormField name="{primaryField}" />
      {showConditionalField && <FormField name="{conditionalField}" />}
    </div>
  );
};
```

> ⚠️ Reality: _{Document mismatches between UI values and API enum values, payload issues, etc. Delete if accurate.}_

#### c. {ToolName}{DomainSection2}Grid

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}{DomainSection2}Grid.tsx`
**Purpose**: Editable data grid for {child items} with inline editing
**Screenshot**: _{Reference to screenshot location}_

##### Props Interface

```typescript
interface {ToolName}{DomainSection2}GridProps {
  {toolId}?: string;
  items: {ToolName}{ItemType}[];
  onUpdate: (items: {ToolName}{ItemType}[]) => void;
  readonly?: boolean;
  projectId: string;
}
```

> ⚠️ Reality: _{Document API endpoint issues, data type mismatches, etc. Delete if accurate.}_

##### Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│ {GRID TITLE}                                         [+ Add {Item}] │
├────────┬─────────────┬──────────┬─────┬──────────┬─────────┬────────┤
│ {Col1} │ {Col2}      │ {Col3}   │{C4} │ {Col5}   │ {Col6}  │ {Col7} │
│        │             │          │     │          │         │        │
├────────┼─────────────┼──────────┼─────┼──────────┼─────────┼────────┤
│{Val1}  │{Val2}       │{Val3}    │{V4} │ {Val5}   │ {Val6}  │{Calc}  │
│[Edit]  │             │[Select▼] │[▼]  │[______]  │[______] │        │
├────────┼─────────────┼──────────┼─────┼──────────┼─────────┼────────┤
│        │             │          │     │          │         │        │
│[+ New] │             │          │     │          │         │        │
├────────┴─────────────┴──────────┴─────┴──────────┴─────────┼────────┤
│                                                     TOTAL: │ {Sum}  │
└────────────────────────────────────────────────────────────┴────────┘
```

##### Grid Features

- **Inline Editing**: Click cells to edit directly
- **Add/Remove Rows**: Dynamic row management
- **Auto-calculations**: {Describe calculated fields — e.g., extended = qty x unit price}
- **Drag-and-drop**: Reorder rows by dragging
- **Bulk Actions**: Select multiple rows for batch operations

##### State Management

```typescript
interface GridState {
  items: {ToolName}{ItemType}[];
  editingRow: number | null;
  selectedRows: Set<number>;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  totals: {ItemType}Totals;
}

const use{DomainSection2}Grid = () => {
  const [state, setState] = useState<GridState>(initialState);

  const addRow = useCallback(() => {
    setState(prev => ({
      ...prev,
      items: [...prev.items, createEmpty{ItemType}()],
      editingRow: prev.items.length
    }));
  }, []);

  const updateRow = useCallback((index: number, data: Partial<{ToolName}{ItemType}>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, ...data } : item
      ),
      totals: calculateTotals(updatedItems)
    }));
  }, []);

  return { state, addRow, updateRow, deleteRow, reorderRows };
};
```

#### d. {ToolName}AttachmentsSection

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}AttachmentsSection.tsx`
**Purpose**: File upload and attachment management
**Screenshot**: _{Reference to screenshot location}_

##### Props Interface

```typescript
interface {ToolName}AttachmentsSectionProps {
  {toolId}?: string;
  attachments: {ToolName}Attachment[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
  maxFileSize?: number; // bytes
  allowedTypes?: string[];
  readonly?: boolean;
}
```

##### Layout Structure

```
┌─────────────────────────────────────────────┐
│ ATTACHMENTS                                 │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │     Drop files here or click            │ │
│ │        to browse                        │ │
│ │                                         │ │
│ │ Supported: PDF, DOC, XLS, JPG, PNG      │ │
│ │ Max size: {N} MB per file               │ │
│ └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│ UPLOADED FILES                              │
├─────────────────────────────────────────────┤
│ {filename1}.pdf                {size}  [x]  │
│ {filename2}.jpg                {size}  [x]  │
│ {filename3}.xlsx               {size}  [x]  │
└─────────────────────────────────────────────┘
```

##### File Upload Features

- **Drag-and-drop**: Drop zone for easy file uploads
- **File Validation**: Size and type restrictions
- **Progress Indicators**: Upload progress with cancel option
- **Preview**: Thumbnail/preview for images
- **Download**: Direct download links
- **Security**: Virus scanning and secure storage

> ⚠️ Reality: _{Document payload key mismatches, ID type issues, etc. Delete if accurate.}_

### 3. {ToolName}TableColumns

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}TableColumns.tsx`
**Purpose**: Table column definitions for data table
**Screenshot**: _{Reference to screenshot location}_

#### Column Configuration

```typescript
export const {toolName}TableColumns: ColumnDef<{ToolName}Summary>[] = [
  {
    accessorKey: "number",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="#" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs">
        {row.getValue("number")}
      </div>
    ),
    meta: { width: "60px" }
  },
  {
    accessorKey: "{primaryField}",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="{Primary Field}" />
    ),
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="max-w-[300px]">
          <div className="font-medium truncate">
            {item.{primaryField}}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {item.{secondaryField} && `{Label}: ${item.{secondaryField}}`}
          </div>
        </div>
      );
    }
  },
  {
    accessorKey: "{categoryField}",
    header: "{Category}",
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.getValue("{categoryField}")}
      </Badge>
    ),
    meta: { width: "120px" }
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={getStatusVariant(status)}>
          {status}
        </Badge>
      );
    },
    meta: { width: "100px" }
  },
  // {Additional columns: amounts, dates, actions...}
];
```

### 4. {ToolName}{WorkflowComponent}

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}{WorkflowComponent}.tsx`
**Purpose**: {Workflow description — e.g., approval process management and status display}
**Screenshot**: _{Reference to screenshot location}_

#### Props Interface

```typescript
interface {ToolName}{WorkflowComponent}Props {
  {toolInstance}: {ToolName};
  {workflowItems}: {ToolName}{WorkflowItem}[];
  currentUser: User;
  onAction1: (comments?: string) => Promise<void>;
  onAction2: (comments: string) => Promise<void>;
  onAction3: (comments: string) => Promise<void>;
}
```

#### Layout Structure

```
┌─────────────────────────────────────────────┐
│ {WORKFLOW TITLE}                            │
├─────────────────────────────────────────────┤
│ Status: {Current Status}                    │
│                                             │
│ ┌─ {Person Name} ({Role})                   │
│ │  Status: {Step Status}                    │
│ │  {Timestamp Label}: {Date Time}           │
│ └─ [{Action1}] [{Action2}] [{Action3}]      │
│                                             │
│ ┌─ {Person Name} ({Role})                   │
│ │  Status: {Step Status}                    │
│ │  {Timestamp Label}: {Date Time}           │
│ └─ Awaiting previous step                   │
└─────────────────────────────────────────────┘
```

> ⚠️ Reality: _{Document missing endpoints, hardcoded data, etc. Delete if accurate.}_

### 5. {ToolName}{ActionDialog}

**File**: `/frontend/src/components/domain/{tool-slug}/{ToolName}{ActionDialog}.tsx`
**Purpose**: {Action description — e.g., convert to change order, export, archive}
**Screenshot**: _{Reference to screenshot location}_

#### Props Interface

```typescript
interface {ToolName}{ActionDialog}Props {
  {toolInstance}: {ToolName};
  open: boolean;
  onClose: () => void;
  onAction: (data: {ActionData}) => Promise<void>;
}
```

#### Layout Structure

```
┌─────────────────────────────────────────────┐
│ {Dialog Title}                           [x]│
├─────────────────────────────────────────────┤
│ {Context Line}: {identifier} - {title}      │
│                                             │
│ ┌─ {Settings Group}                        ││
│ │  {Setting1}: [{Dropdown v}]              ││
│ │  {Setting2}: [{Dropdown v}]              ││
│ │  {Setting3}: [____] {unit}               ││
│ │                                          ││
│ │  [x] {Checkbox option 1}                 ││
│ │  [x] {Checkbox option 2}                 ││
│ │  [ ] {Checkbox option 3}                 ││
│ └─                                         ││
│                                             │
│ {Summary Title}:                            │
│ - {Metric 1}: {value}                       │
│ - {Metric 2}: {value}                       │
│ - {Metric 3}: {value}                       │
│                                             │
├─────────────────────────────────────────────┤
│                   [Cancel] [{Action Verb}]   │
└─────────────────────────────────────────────┘
```

## Responsive Design Details

### Breakpoint Strategy

```typescript
const breakpoints = {
  mobile: '640px',    // Stack form sections vertically
  tablet: '768px',    // Adjust table columns
  desktop: '1024px',  // Full layout
  wide: '1280px'      // Extra wide for detailed views
};
```

### Mobile Adaptations

- **Forms**: Single column layout with collapsible sections
- **Tables**: Horizontal scroll with sticky first column
- **Grids**: Card layout instead of table layout
- **Navigation**: Hamburger menu for tabs

### Tablet Adaptations

- **Forms**: Two-column layout where space permits
- **Tables**: Hide less critical columns
- **Modals**: Adjusted padding and sizing

## State Management Patterns

### Component State Architecture

```typescript
// Global app state
const {ToolName}Context = createContext<{
  items: {ToolName}Summary[];
  loading: boolean;
  error: string | null;
  filters: FilterState;
  pagination: PaginationState;
}>();

// Form state
const use{ToolName}Form = () => {
  const form = useForm<{ToolName}FormData>();
  const [childItems, setChildItems] = useState<{ToolName}{ItemType}[]>([]);
  const [attachments, setAttachments] = useState<{ToolName}Attachment[]>([]);

  const submitForm = useCallback(async () => {
    // Validation and submission logic
  }, [form.formState]);

  return { form, childItems, attachments, submitForm };
};

// List state
const use{ToolName}List = (projectId: string) => {
  const [data, setData] = useState<{ToolName}Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    search: '',
    page: 1
  });

  useEffect(() => {
    fetch{ToolName}s(projectId, filters).then(setData);
  }, [projectId, filters]);

  return { data, loading, filters, setFilters };
};
```

## Accessibility Features

### Keyboard Navigation

- **Tab Order**: Logical tab sequence through form fields
- **Arrow Keys**: Navigate table cells and grid items
- **Enter/Space**: Activate buttons and selections
- **Escape**: Close modals and cancel editing

### Screen Reader Support

- **ARIA Labels**: Descriptive labels for all form controls
- **Live Regions**: Announce dynamic content changes
- **Table Headers**: Proper header associations for data tables
- **Error Announcements**: Validation errors announced immediately

### Visual Accessibility

- **High Contrast**: WCAG AA contrast ratios
- **Focus Indicators**: Clear focus outlines
- **Error States**: Color plus text for error indication
- **Font Sizes**: Minimum 16px for readability

## Performance Considerations

### Component Optimization

```typescript
// Memoized table columns to prevent re-renders
export const {toolName}TableColumns = useMemo(() => [
  // column definitions
], []);

// Virtualized rendering for large datasets
const Virtualized{DomainSection2}Grid = memo(({ items }: { items: {ToolName}{ItemType}[] }) => {
  return (
    <FixedSizeList
      height={400}
      itemCount={items.length}
      itemSize={50}
      itemData={items}
    >
      {{ItemType}Row}
    </FixedSizeList>
  );
});

// Debounced search input
const useDebounceSearch = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};
```

### Loading States

- **Skeleton Components**: Loading placeholders matching layout
- **Progressive Loading**: Load critical content first
- **Optimistic Updates**: Immediate UI feedback for user actions
- **Error Boundaries**: Graceful error handling without full page crashes

---

## How to Use This Template

1. **Find & Replace** all `{ToolName}` with your PascalCase name (e.g., `ChangeEvent`, `DirectCost`, `PrimeContract`)
2. **Find & Replace** all `{toolName}` with your camelCase name (e.g., `changeEvent`, `directCost`, `primeContract`)
3. **Find & Replace** all `{tool-slug}` with your kebab-case route slug (e.g., `change-events`, `direct-costs`, `prime-contracts`)
4. **Find & Replace** all `{tool name}` with your lowercase display name (e.g., `change event`, `direct cost`)
5. **Find & Replace** all `{Tool Name}` with your title-case display name (e.g., `Change Event`, `Direct Cost`)
6. **Fill in** domain-specific placeholders: `{DomainSection1}`, `{DomainSection2}`, `{ItemType}`, `{WorkflowComponent}`, `{ActionDialog}`, etc.
7. **Fill in** field names, column definitions, status values, and dropdown options for your tool
8. **Fill in** Reality Notes with honest assessment of current implementation state
9. **Delete** any sections or components that don't apply to your tool
10. **Add** any tool-specific sections not covered by this template
