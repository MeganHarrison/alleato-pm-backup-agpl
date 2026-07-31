# Version Control and Revision Tracking Patterns Analysis

## Pattern Analysis Report

**Summary**

- Total files analyzed: 1021+ files across database, API, and UI layers
- Version control patterns found: 8 major patterns
- Audit/history tracking patterns: 6 implementations
- Status workflow patterns: 12+ enum-based workflows
- Critical pattern types identified: Document versioning, status workflows, audit trails, UI components

## Database Schema Patterns Found

### 1. Document Version Pattern (High Priority)

**Location**: `contract_documents` table
**Type**: Full version control with current version tracking
**Severity**: High - Perfect reference for drawing revisions

**Schema Pattern**:

```sql
CREATE TABLE contract_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    contract_id uuid NOT NULL,
    document_name text NOT NULL,
    document_type text NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    mime_type text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,           -- Sequential version number
    is_current_version boolean DEFAULT true NOT NULL, -- Active version flag
    notes text,                                  -- Version change notes
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contract_documents_document_type_check
        CHECK ((document_type = ANY (ARRAY['contract', 'amendment', ...])))
);
```
**Key Features**:
- Sequential integer versioning (`version`)
- Current version tracking (`is_current_version`)
- Version-specific metadata (file_path, file_size)
- Change documentation (`notes`)
- Full audit timestamps

### 2. Submittal Version Pattern (Medium Priority)
**Location**: `submittals` table
**Type**: Version counting with document tracking
**Severity**: Medium - Good pattern for revision summaries

**Schema Pattern**:
```sql
CREATE TABLE submittals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id integer NOT NULL,
    submittal_number text NOT NULL,
    title text NOT NULL,
    description text,
    status text,
    current_version integer,              -- Track current revision
    total_versions integer,              -- Total revision count
    submission_date timestamp,
    required_approval_date timestamp,
    -- ... other fields
);

CREATE TABLE submittal_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submittal_id uuid NOT NULL,
    document_name text NOT NULL,
    file_url text NOT NULL,
    version integer,                     -- Document version
    uploaded_by text NOT NULL,
    uploaded_at timestamp,
    -- ... other fields
);
```
**Key Features**:

- Master record tracks version count
- Individual documents have version numbers
- Supports multiple document versions per submittal

### 3. Project Document Pattern

**Location**: `project_briefings`, `qtos` tables
**Type**: Simple version incrementing
**Severity**: Low - Basic versioning only

**Schema Pattern**:

```sql
-- Simple version tracking
version integer DEFAULT 1
```
## Audit Trail Patterns Found

### 1. Budget Line History Pattern (Critical Reference)
**Location**: `budget_line_history` table
**Type**: Complete audit trail with field-level tracking
**Severity**: Critical - Perfect model for drawing revision history

**Schema Pattern**:
```sql
CREATE TABLE budget_line_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    budget_line_id uuid NOT NULL,
    project_id integer,
    change_type text NOT NULL,           -- 'create', 'update', 'delete'
    field_name text,                     -- Which field changed
    old_value text,                      -- Previous value
    new_value text,                      -- New value
    changed_by uuid,                     -- User who made change
    changed_at timestamp DEFAULT now() NOT NULL,
    notes text                           -- Optional change description
);
```

**Key Features**:

- Field-level change tracking
- Before/after value comparison
- Change type categorization
- Full user attribution
- Timestamp tracking

### 2. Change Event History Pattern

**Location**: `change_event_history` table
**Type**: Similar to budget line history
**Severity**: High - Consistent audit pattern

**Schema Pattern**:

```sql
CREATE TABLE change_event_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    change_event_id uuid NOT NULL,
    change_type text NOT NULL,
    field_name text,
    old_value text,
    new_value text,
    changed_by uuid,
    changed_at timestamp DEFAULT now() NOT NULL
);
```
### 3. Submittal History Pattern
**Location**: `submittal_history` table
**Type**: Action-based history with status tracking
**Severity**: Medium - Good for status workflow history

**Schema Pattern**:
```sql
CREATE TABLE submittal_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submittal_id uuid NOT NULL,
    action text NOT NULL,               -- Action performed
    actor_id uuid,                      -- User who performed action
    actor_type text,                    -- Type of actor
    timestamp timestamp DEFAULT now() NOT NULL,
    previous_status text,               -- Previous status
    new_status text,                    -- New status
    changes jsonb,                      -- Structured change data
    notes text                          -- Action notes
);
```
## Status Workflow Patterns

### Status Enum Patterns Found:

```typescript
// Drawing revision status workflow (recommended)
drawing_revision_status: "draft" | "under_review" | "approved" | "superseded" | "void"

// Change order status (existing pattern)
change_order_status: "draft" | "pending" | "approved" | "void"

// Contract status (existing pattern)
contract_status: "draft" | "pending" | "executed" | "closed" | "terminated"

// Invoice status (existing pattern)
invoice_status: "draft" | "pending" | "approved" | "paid" | "void"

// Prime contract status (comprehensive)
prime_contract_status_v2:
  | "draft"
  | "pending_approval"
  | "approved"
  | "executed"
  | "closed"
  | "terminated"
  | "on_hold"
```
**Recommended Status Workflow for Drawing Revisions**:
1. **draft** - Initial creation, not ready for review
2. **under_review** - Submitted for approval
3. **approved** - Approved for construction use
4. **superseded** - Replaced by newer revision
5. **void** - Cancelled/invalid

## API Patterns for Version Management

### 1. Version History API Pattern
**Location**: `budget-line-history-modal.tsx`
**Type**: RESTful history endpoint
**Severity**: High - Direct implementation pattern

**API Pattern**:
```typescript
// Get change history for specific item
GET /api/projects/{projectId}/budget/lines/{lineItemId}/history

// Response format
interface HistoryEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: {
    id: string;
    email: string;
    name: string;
  };
  changed_at: string;
  change_type: "create" | "update" | "delete";
  notes: string | null;
}
```

### 2. Project History API Pattern

**Location**: `change-history-tab.tsx`
**Type**: Project-level aggregated history
**Severity**: Medium - Good for project-wide revision tracking

**API Pattern**:

```typescript
// Get all changes for project
GET /api/projects/{projectId}/budget/history

// Response includes statistics and change log
interface HistoryData {
  changes: ChangeRecord[];
  statistics: {
    totalChanges: number;
    changesThisMonth: number;
    activeUsers: number;
    lastChange: string | null;
  };
}
```
### 3. Document Status API Pattern
**Location**: `documents/status/route.ts`
**Type**: Document processing status with metadata
**Severity**: Medium - Good for tracking document processing

**API Pattern**:
```typescript
// Get document status with pipeline information
GET /api/documents/status

// Tracks processing stages and status
interface DocumentStatus {
  id: string;
  status: string;
  pipeline_stage: string;
  attempt_count: number;
  last_attempt_at: string;
  error_message: string;
}
```
## UI Component Patterns for Revision History

### 1. Modal History View Pattern (High Priority)

**Location**: `budget-line-history-modal.tsx`
**Type**: Complete change history modal with visual timeline
**Severity**: Critical - Perfect for drawing revision history UI

**UI Features**:

- Modal dialog for focused history view
- Visual timeline with change type indicators
- Color-coded change types (create=green, update=blue, delete=red)
- Before/after value comparison with strikethrough
- User attribution and timestamps
- Field name mapping for user-friendly display
- Loading and error states

**Visual Pattern**:

```tsx
// Change entry with visual indicators
<div className="border-l-4 border-blue-500/70 pl-4">
  <div className="flex items-start gap-3">
    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100">
      {/* Change type icon */}
    </div>
    <div className="flex-1">
      <div className="text-sm font-semibold">{user.name}</div>
      <div className="text-xs text-muted-foreground">
        {formatDistanceToNow(timestamp)}
      </div>
      <div className="text-sm">
        Changed {field} from
        <span className="line-through text-red-600">{oldValue}</span>
        to
        <span className="font-medium text-green-700">{newValue}</span>
      </div>
    </div>
  </div>
</div>
```
### 2. Tab-Based History View Pattern (Medium Priority)
**Location**: `change-history-tab.tsx`
**Type**: Full-page history with statistics and filtering
**Severity**: Medium - Good for comprehensive revision management

**UI Features**:
- Statistics dashboard (total changes, monthly changes, active users)
- Filterable change log
- Export functionality
- Refresh capability
- Badge-coded action types
- Scrollable history list

### 3. Version Switcher Pattern (Low Priority)
**Location**: `version-switcher.tsx`
**Type**: Dropdown version selector
**Severity**: Low - Simple version navigation

**UI Features**:
- Dropdown menu for version selection
- Visual indicator of current version
- Simple version list navigation

## Critical Implementation Recommendations

### Immediate Priorities for Drawing Revisions:

1. **Database Schema**: Use `contract_documents` pattern with:
   - `version` integer field
   - `is_current_version` boolean
   - `revision_notes` text field
   - Status enum for workflow

2. **Audit Trail**: Implement `budget_line_history` pattern for:
   - Field-level change tracking
   - Status transition history
   - User attribution
   - Before/after comparisons

3. **API Endpoints**: Follow existing patterns:
   ```text

   GET /api/projects/{projectId}/drawings/{drawingId}/revisions
   GET /api/projects/{projectId}/drawings/{drawingId}/history
   POST /api/projects/{projectId}/drawings/{drawingId}/revisions

   ```

1. **UI Components**: Adapt `budget-line-history-modal.tsx` for:
   - Drawing revision history modal
   - Visual timeline of revisions
   - Status workflow indicators
   - Version comparison views

### Database Migration Pattern:

```sql
-- Main drawings table with current version tracking
CREATE TABLE drawings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id integer NOT NULL,
    drawing_number text NOT NULL,
    title text NOT NULL,
    current_revision text DEFAULT 'A' NOT NULL,
    current_version_id uuid,                    -- FK to current revision
    status drawing_status DEFAULT 'draft' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Drawing revisions (versions)
CREATE TABLE drawing_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drawing_id uuid NOT NULL,
    revision_letter text NOT NULL,              -- A, B, C, etc.
    version_number integer DEFAULT 1 NOT NULL,  -- For sequential tracking
    file_path text NOT NULL,
    file_size bigint,
    mime_type text,
    status revision_status DEFAULT 'draft' NOT NULL,
    is_current_version boolean DEFAULT false NOT NULL,
    revision_description text,                  -- What changed in this revision
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT drawing_revisions_drawing_id_fkey
        FOREIGN KEY (drawing_id) REFERENCES drawings(id)
);

-- Drawing revision history (audit trail)
CREATE TABLE drawing_revision_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    revision_id uuid NOT NULL,
    drawing_id uuid NOT NULL,
    project_id integer NOT NULL,
    change_type text NOT NULL,                  -- 'create', 'status_change', 'supersede'
    field_name text,                           -- 'status', 'is_current_version', etc.
    old_value text,
    new_value text,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,                                -- Change reason/description
    CONSTRAINT drawing_revision_history_revision_id_fkey
        FOREIGN KEY (revision_id) REFERENCES drawing_revisions(id)
);

-- Status enums
CREATE TYPE drawing_status AS ENUM ('active', 'archived', 'superseded');
CREATE TYPE revision_status AS ENUM ('draft', 'under_review', 'approved', 'superseded', 'void');
```

This analysis provides a comprehensive foundation for implementing drawing revisions and version control based on proven patterns already established in the codebase.
