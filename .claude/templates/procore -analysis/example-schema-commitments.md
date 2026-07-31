---
title: SCHEMA Commitments
description: SCHEMA Commitments documentation
---

# Commitments Database Schema

## Database Tables Overview

The Commitments module uses ...

### Core Tables

- `subcontracts` - Subcontractor agreements and work commitments
- `purchase_orders` - Material and equipment purchase orders
- `subcontract_sov_items` - Schedule of Values line items for subcontracts
- `purchase_order_sov_items` - Line items for purchase orders
- `commitments_unified` - View combining both commitment types
- `subcontract_attachments` - File attachments for subcontracts

### Relationship Overview

```text
subcontracts (1) ←→ (M) subcontract_sov_items
purchase_orders (1) ←→ (M) purchase_order_sov_items
subcontracts (1) ←→ (M) subcontract_attachments
companies (1) ←→ (M) subcontracts
companies (1) ←→ (M) purchase_orders
project_budget_codes (1) ←→ (M) sov_items
```

## Table Definitions

### 1. subcontracts

Complete table for subcontractor commitments with Procore field parity.

```sql
CREATE TABLE subcontracts (
    -- Primary key and metadata
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL, -- For soft delete

    -- Basic Information
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'pending', 'approved', 'executed', 'closed', 'void'
    )),
    contract_company_id UUID REFERENCES companies(id),
    contract_number VARCHAR(100) NOT NULL,
    description TEXT,

    -- Financial Information
    original_contract_amount DECIMAL(15,2) DEFAULT 0,
    revised_contract_amount DECIMAL(15,2) DEFAULT 0,
    default_retainage_percent DECIMAL(5,2) DEFAULT 0 CHECK (default_retainage_percent >= 0 AND default_retainage_percent <= 100),
    accounting_method VARCHAR(20) DEFAULT 'amount_based' CHECK (accounting_method IN ('amount_based', 'unit_quantity')),

    -- Dates
    start_date DATE,
    estimated_completion_date DATE,
    actual_completion_date DATE,
    contract_date DATE,
    signed_contract_received_date DATE,
    issued_on_date DATE,

    -- Scope and Terms
    inclusions TEXT, -- Rich text content
    exclusions TEXT, -- Rich text content

    -- Flags and Settings
    executed BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT TRUE,
    allow_non_admin_view_sov_items BOOLEAN DEFAULT FALSE,

    -- ERP Integration
    erp_status VARCHAR(50),
    ssov_status VARCHAR(50),

    -- Access Control
    non_admin_user_ids UUID[] DEFAULT '{}',
    invoice_contact_ids UUID[] DEFAULT '{}',

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    project_id UUID NOT NULL REFERENCES projects(id),

    -- Constraints
    CONSTRAINT valid_contract_number CHECK (LENGTH(contract_number) > 0),
    CONSTRAINT valid_title CHECK (LENGTH(title) > 0)
);

-- Indexes for performance
CREATE INDEX idx_subcontracts_project_id ON subcontracts(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subcontracts_status ON subcontracts(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_subcontracts_company ON subcontracts(contract_company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_subcontracts_contract_number ON subcontracts(contract_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_subcontracts_deleted_at ON subcontracts(deleted_at);
```

### 2. purchase_orders

Purchase order table with shipping and procurement-specific fields.

```sql
CREATE TABLE purchase_orders (
    -- Primary key and metadata
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE NULL, -- For soft delete

    -- Basic Information
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft', 'sent', 'pending', 'approved', 'executed', 'closed', 'void'
    )),
    contract_company_id UUID REFERENCES companies(id),
    contract_number VARCHAR(100) NOT NULL,
    description TEXT,

    -- Financial Information
    original_contract_amount DECIMAL(15,2) DEFAULT 0,
    revised_contract_amount DECIMAL(15,2) DEFAULT 0,
    default_retainage_percent DECIMAL(5,2) DEFAULT 0 CHECK (default_retainage_percent >= 0 AND default_retainage_percent <= 100),
    accounting_method VARCHAR(20) DEFAULT 'amount_based' CHECK (accounting_method IN ('amount_based', 'unit_quantity')),

    -- Purchase Order Specific Fields
    ship_to TEXT,
    ship_via VARCHAR(255),
    bill_to TEXT,
    delivery_date DATE,
    payment_terms TEXT,
    assigned_to UUID REFERENCES auth.users(id),

    -- Dates
    start_date DATE,
    estimated_completion_date DATE,
    actual_completion_date DATE,
    contract_date DATE,
    signed_contract_received_date DATE,
    issued_on_date DATE,

    -- Flags and Settings
    executed BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT TRUE,
    allow_non_admin_view_sov_items BOOLEAN DEFAULT FALSE,

    -- ERP Integration
    erp_status VARCHAR(50),
    ssov_status VARCHAR(50),

    -- Access Control
    non_admin_user_ids UUID[] DEFAULT '{}',
    invoice_contact_ids UUID[] DEFAULT '{}',

    -- Audit
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    project_id UUID NOT NULL REFERENCES projects(id),

    -- Constraints
    CONSTRAINT valid_po_contract_number CHECK (LENGTH(contract_number) > 0),
    CONSTRAINT valid_po_title CHECK (LENGTH(title) > 0)
);

-- Indexes for performance
CREATE INDEX idx_purchase_orders_project_id ON purchase_orders(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_company ON purchase_orders(contract_company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_contract_number ON purchase_orders(contract_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_assigned_to ON purchase_orders(assigned_to) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_delivery_date ON purchase_orders(delivery_date) WHERE deleted_at IS NULL;
```

### 3. subcontract_sov_items

Schedule of Values line items for subcontracts.

```sql
CREATE TABLE subcontract_sov_items (
    -- Primary key and metadata
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Relationships
    subcontract_id UUID NOT NULL REFERENCES subcontracts(id) ON DELETE CASCADE,
    budget_code_id UUID REFERENCES project_budget_codes(id),
    change_event_line_item_id UUID, -- Optional link to change events

    -- Line Item Data
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,

    -- Calculated Fields (updated by triggers)
    billed_to_date DECIMAL(15,2) DEFAULT 0,
    amount_remaining DECIMAL(15,2) GENERATED ALWAYS AS (amount - billed_to_date) STORED,

    -- Constraints
    CONSTRAINT valid_sov_amount CHECK (amount >= 0),
    CONSTRAINT valid_sov_description CHECK (LENGTH(description) > 0),
    CONSTRAINT valid_sov_line_number CHECK (line_number > 0),
    CONSTRAINT unique_subcontract_line_number UNIQUE (subcontract_id, line_number)
);

-- Indexes
CREATE INDEX idx_subcontract_sov_items_subcontract ON subcontract_sov_items(subcontract_id);
CREATE INDEX idx_subcontract_sov_items_budget_code ON subcontract_sov_items(budget_code_id);
CREATE INDEX idx_subcontract_sov_items_line_number ON subcontract_sov_items(subcontract_id, line_number);
```

### 4. purchase_order_sov_items

Schedule of Values line items for purchase orders.

```sql
CREATE TABLE purchase_order_sov_items (
    -- Primary key and metadata
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Relationships
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    budget_code_id UUID REFERENCES project_budget_codes(id),
    change_event_line_item_id UUID, -- Optional link to change events

    -- Line Item Data
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    quantity DECIMAL(10,3), -- For unit-based accounting
    unit_cost DECIMAL(15,2), -- For unit-based accounting
    unit_of_measure VARCHAR(50), -- For unit-based accounting

    -- Calculated Fields
    billed_to_date DECIMAL(15,2) DEFAULT 0,
    amount_remaining DECIMAL(15,2) GENERATED ALWAYS AS (amount - billed_to_date) STORED,

    -- Constraints
    CONSTRAINT valid_po_sov_amount CHECK (amount >= 0),
    CONSTRAINT valid_po_sov_description CHECK (LENGTH(description) > 0),
    CONSTRAINT valid_po_sov_line_number CHECK (line_number > 0),
    CONSTRAINT unique_po_line_number UNIQUE (purchase_order_id, line_number)
);

-- Indexes
CREATE INDEX idx_po_sov_items_purchase_order ON purchase_order_sov_items(purchase_order_id);
CREATE INDEX idx_po_sov_items_budget_code ON purchase_order_sov_items(budget_code_id);
CREATE INDEX idx_po_sov_items_line_number ON purchase_order_sov_items(purchase_order_id, line_number);
```

### 5. subcontract_attachments

File attachments for subcontracts with Supabase storage integration.

```sql
CREATE TABLE subcontract_attachments (
    -- Primary key and metadata
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Relationships
    subcontract_id UUID NOT NULL REFERENCES subcontracts(id) ON DELETE CASCADE,

    -- File Information
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT, -- File size in bytes
    file_type VARCHAR(100), -- MIME type
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    storage_url TEXT, -- Public URL if applicable

    -- Metadata
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT valid_filename CHECK (LENGTH(filename) > 0),
    CONSTRAINT valid_storage_path CHECK (LENGTH(storage_path) > 0)
);

-- Indexes
CREATE INDEX idx_subcontract_attachments_subcontract ON subcontract_attachments(subcontract_id);
CREATE INDEX idx_subcontract_attachments_uploaded_by ON subcontract_attachments(uploaded_by);
CREATE INDEX idx_subcontract_attachments_created_at ON subcontract_attachments(created_at);
```

## Views and Helper Functions

### 1. commitments_unified View

Unified view combining subcontracts and purchase orders for list displays.

```sql
CREATE OR REPLACE VIEW commitments_unified AS
SELECT
    -- Common identification
    'subcontract' AS commitment_type,
    s.id,
    s.title,
    s.status,
    s.contract_number,
    s.contract_company_id,
    c.name AS company_name,
    s.project_id,

    -- Financial data
    s.original_contract_amount,
    s.revised_contract_amount,
    s.default_retainage_percent,

    -- Calculated totals (from subqueries)
    COALESCE(sov.total_sov_amount, 0) AS total_sov_amount,
    COALESCE(cos.approved_change_orders, 0) AS approved_change_orders,
    COALESCE(cos.pending_change_orders, 0) AS pending_change_orders,
    COALESCE(cos.draft_change_orders, 0) AS draft_change_orders,
    COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
    COALESCE(inv.payments_issued, 0) AS payments_issued,

    -- Calculated fields
    CASE
        WHEN s.revised_contract_amount > 0
        THEN ROUND((COALESCE(inv.payments_issued, 0) / s.revised_contract_amount) * 100, 2)
        ELSE 0
    END AS percent_paid,
    s.revised_contract_amount - COALESCE(inv.payments_issued, 0) AS remaining_balance,

    -- Flags and metadata
    s.executed,
    s.is_private,
    s.erp_status,
    s.ssov_status,
    s.created_at,
    s.updated_at,
    s.deleted_at

FROM subcontracts s
LEFT JOIN companies c ON s.contract_company_id = c.id
LEFT JOIN (
    -- SOV totals subquery
    SELECT
        subcontract_id,
        SUM(amount) AS total_sov_amount,
        SUM(billed_to_date) AS total_billed
    FROM subcontract_sov_items
    GROUP BY subcontract_id
) sov ON s.id = sov.subcontract_id
LEFT JOIN (
    -- Change orders totals subquery
    SELECT
        commitment_id,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved_change_orders,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_change_orders,
        SUM(CASE WHEN status = 'draft' THEN amount ELSE 0 END) AS draft_change_orders
    FROM change_orders
    WHERE commitment_type = 'subcontract'
    GROUP BY commitment_id
) cos ON s.id = cos.commitment_id
LEFT JOIN (
    -- Invoice totals subquery
    SELECT
        commitment_id,
        SUM(total_amount) AS invoiced_amount,
        SUM(paid_amount) AS payments_issued
    FROM invoices
    WHERE commitment_type = 'subcontract' AND status = 'approved'
    GROUP BY commitment_id
) inv ON s.id = inv.commitment_id

UNION ALL

SELECT
    -- Purchase orders with same structure
    'purchase_order' AS commitment_type,
    po.id,
    po.title,
    po.status,
    po.contract_number,
    po.contract_company_id,
    c.name AS company_name,
    po.project_id,

    -- Financial data
    po.original_contract_amount,
    po.revised_contract_amount,
    po.default_retainage_percent,

    -- Calculated totals
    COALESCE(sov.total_sov_amount, 0) AS total_sov_amount,
    COALESCE(cos.approved_change_orders, 0) AS approved_change_orders,
    COALESCE(cos.pending_change_orders, 0) AS pending_change_orders,
    COALESCE(cos.draft_change_orders, 0) AS draft_change_orders,
    COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
    COALESCE(inv.payments_issued, 0) AS payments_issued,

    -- Calculated fields
    CASE
        WHEN po.revised_contract_amount > 0
        THEN ROUND((COALESCE(inv.payments_issued, 0) / po.revised_contract_amount) * 100, 2)
        ELSE 0
    END AS percent_paid,
    po.revised_contract_amount - COALESCE(inv.payments_issued, 0) AS remaining_balance,

    -- Flags and metadata
    po.executed,
    po.is_private,
    po.erp_status,
    po.ssov_status,
    po.created_at,
    po.updated_at,
    po.deleted_at

FROM purchase_orders po
LEFT JOIN companies c ON po.contract_company_id = c.id
LEFT JOIN (
    -- SOV totals for PO
    SELECT
        purchase_order_id,
        SUM(amount) AS total_sov_amount,
        SUM(billed_to_date) AS total_billed
    FROM purchase_order_sov_items
    GROUP BY purchase_order_id
) sov ON po.id = sov.purchase_order_id
LEFT JOIN (
    -- Change orders for PO
    SELECT
        commitment_id,
        SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS approved_change_orders,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_change_orders,
        SUM(CASE WHEN status = 'draft' THEN amount ELSE 0 END) AS draft_change_orders
    FROM change_orders
    WHERE commitment_type = 'purchase_order'
    GROUP BY commitment_id
) cos ON po.id = cos.commitment_id
LEFT JOIN (
    -- Invoice totals for PO
    SELECT
        commitment_id,
        SUM(total_amount) AS invoiced_amount,
        SUM(paid_amount) AS payments_issued
    FROM invoices
    WHERE commitment_type = 'purchase_order' AND status = 'approved'
    GROUP BY commitment_id
) inv ON po.id = inv.commitment_id;

-- Index on the view for performance
CREATE INDEX idx_commitments_unified_project_deleted ON commitments_unified(project_id, deleted_at);
CREATE INDEX idx_commitments_unified_type_status ON commitments_unified(commitment_type, status);
```

### 2. Helper Functions

```sql
-- Function to update SOV totals
CREATE OR REPLACE FUNCTION update_commitment_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Update subcontract totals when SOV items change
    IF TG_TABLE_NAME = 'subcontract_sov_items' THEN
        UPDATE subcontracts
        SET
            revised_contract_amount = (
                SELECT COALESCE(SUM(amount), 0)
                FROM subcontract_sov_items
                WHERE subcontract_id = COALESCE(NEW.subcontract_id, OLD.subcontract_id)
            ),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.subcontract_id, OLD.subcontract_id);
    END IF;

    -- Update purchase order totals when SOV items change
    IF TG_TABLE_NAME = 'purchase_order_sov_items' THEN
        UPDATE purchase_orders
        SET
            revised_contract_amount = (
                SELECT COALESCE(SUM(amount), 0)
                FROM purchase_order_sov_items
                WHERE purchase_order_id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id)
            ),
            updated_at = NOW()
        WHERE id = COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic total updates
CREATE TRIGGER trigger_update_subcontract_totals
    AFTER INSERT OR UPDATE OR DELETE ON subcontract_sov_items
    FOR EACH ROW EXECUTE FUNCTION update_commitment_totals();

CREATE TRIGGER trigger_update_po_totals
    AFTER INSERT OR UPDATE OR DELETE ON purchase_order_sov_items
    FOR EACH ROW EXECUTE FUNCTION update_commitment_totals();

-- Function to generate contract numbers
CREATE OR REPLACE FUNCTION generate_contract_number(
    project_uuid UUID,
    commitment_type_param TEXT
)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    counter INTEGER;
    project_code TEXT;
BEGIN
    -- Get project code (or use fallback)
    SELECT COALESCE(code, 'PROJ') INTO project_code
    FROM projects
    WHERE id = project_uuid;

    -- Set prefix based on type
    prefix := CASE commitment_type_param
        WHEN 'subcontract' THEN 'SC'
        WHEN 'purchase_order' THEN 'PO'
        ELSE 'CM'
    END;

    -- Get next number in sequence
    SELECT COALESCE(MAX(
        CASE
            WHEN commitment_type_param = 'subcontract'
            THEN (regexp_match(contract_number, prefix || '-(\d+)'))[1]::INTEGER
            WHEN commitment_type_param = 'purchase_order'
            THEN (regexp_match(contract_number, prefix || '-(\d+)'))[1]::INTEGER
            ELSE 0
        END
    ), 0) + 1 INTO counter
    FROM commitments_unified
    WHERE project_id = project_uuid
    AND commitment_type = commitment_type_param;

    -- Return formatted number
    RETURN project_code || '-' || prefix || '-' || LPAD(counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

## Data Migration Scripts

### Migration from Existing Structure

```sql
-- Migration script to add missing columns for soft delete
ALTER TABLE subcontracts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for soft delete
CREATE INDEX IF NOT EXISTS idx_subcontracts_deleted_at ON subcontracts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_deleted_at ON purchase_orders(deleted_at);

-- Add ERP status columns
ALTER TABLE subcontracts ADD COLUMN IF NOT EXISTS erp_status VARCHAR(50);
ALTER TABLE subcontracts ADD COLUMN IF NOT EXISTS ssov_status VARCHAR(50);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS erp_status VARCHAR(50);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS ssov_status VARCHAR(50);

-- Add access control arrays
ALTER TABLE subcontracts ADD COLUMN IF NOT EXISTS non_admin_user_ids UUID[] DEFAULT '{}';
ALTER TABLE subcontracts ADD COLUMN IF NOT EXISTS invoice_contact_ids UUID[] DEFAULT '{}';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS non_admin_user_ids UUID[] DEFAULT '{}';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_contact_ids UUID[] DEFAULT '{}';

-- Add file size column to attachments
ALTER TABLE subcontract_attachments ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Update existing data with default values
UPDATE subcontracts SET
    deleted_at = NULL,
    erp_status = 'pending',
    ssov_status = 'not_submitted'
WHERE deleted_at IS NULL;

UPDATE purchase_orders SET
    deleted_at = NULL,
    erp_status = 'pending',
    ssov_status = 'not_applicable'
WHERE deleted_at IS NULL;
```sql
### Data Validation Scripts

```sql
-- Validate data integrity
SELECT
    'subcontracts' AS table_name,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_records,
    COUNT(*) FILTER (WHERE title IS NULL OR title = '') AS invalid_titles,
    COUNT(*) FILTER (WHERE contract_number IS NULL OR contract_number = '') AS invalid_numbers
FROM subcontracts

UNION ALL

SELECT
    'purchase_orders' AS table_name,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE deleted_at IS NULL) AS active_records,
    COUNT(*) FILTER (WHERE title IS NULL OR title = '') AS invalid_titles,
    COUNT(*) FILTER (WHERE contract_number IS NULL OR contract_number = '') AS invalid_numbers
FROM purchase_orders

UNION ALL

SELECT
    'subcontract_sov_items' AS table_name,
    COUNT(*) AS total_records,
    COUNT(*) AS active_records,
    COUNT(*) FILTER (WHERE description IS NULL OR description = '') AS invalid_descriptions,
    COUNT(*) FILTER (WHERE amount < 0) AS invalid_amounts
FROM subcontract_sov_items;

-- Check for orphaned records
SELECT 'Orphaned SOV Items' AS issue, COUNT(*) AS count
FROM subcontract_sov_items ssi
LEFT JOIN subcontracts s ON ssi.subcontract_id = s.id
WHERE s.id IS NULL

UNION ALL

SELECT 'Orphaned PO SOV Items' AS issue, COUNT(*) AS count
FROM purchase_order_sov_items psi
LEFT JOIN purchase_orders po ON psi.purchase_order_id = po.id
WHERE po.id IS NULL;
```

## Performance Considerations

### Indexing Strategy

1. **Composite Indexes**: Project + Status + Deleted for fast list queries
2. **Foreign Key Indexes**: All foreign keys have indexes
3. **Search Indexes**: Contract number and title for search functionality
4. **Date Indexes**: Created/updated dates for sorting

### Query Optimization

1. **Materialized Views**: Consider for complex aggregations
2. **Partial Indexes**: Use `WHERE deleted_at IS NULL` for active records
3. **Generated Columns**: Use for calculated fields like `amount_remaining`
4. **Connection Pooling**: Use Supabase connection pooling for high load

### Maintenance

1. **Regular VACUUM**: Keep tables optimized
2. **Index Monitoring**: Monitor index usage and performance
3. **Archive Strategy**: Move old deleted records to archive tables
4. **Backup Strategy**: Regular backups with point-in-time recovery
