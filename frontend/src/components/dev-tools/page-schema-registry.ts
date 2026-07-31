/**
 * Page Schema Registry
 *
 * Maps route segments to their associated Supabase tables, API routes,
 * and form field → DB column mappings. Used by the Developer Tools panel
 * to show contextual schema information for the current page.
 */
import { PAGE_SCHEMA_FK_TARGETS } from "./page-schema-fk.generated"

export interface ColumnDef {
  name: string
  type: string
  pk?: boolean
  fk?: { table: string; column: string }
  nullable?: boolean
  notes?: string
}

export interface TableSchema {
  name: string
  description: string
  columns: ColumnDef[]
}

export interface ApiRoute {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  path: string
  description: string
}

export interface FieldMapping {
  formField: string
  dbColumn: string
  dbTable: string
  fkTarget?: string
  dropdownSource?: string
  notes?: string
}

export interface PageSchemaEntry {
  label: string
  match: string | string[]
  tables: TableSchema[]
  apiRoutes: ApiRoute[]
  fieldMappings: FieldMapping[]
}

function getFkTarget(tableName: string, columnName: string, fallback: string): string {
  return PAGE_SCHEMA_FK_TARGETS[`${tableName}.${columnName}`] ?? fallback
}

function getMismatchNote(
  fkTarget: string | undefined,
  dropdownSource: string | undefined,
  mismatchNote: string,
  alignedNote?: string,
): string | undefined {
  if (!fkTarget || !dropdownSource) return undefined
  if (fkTarget === dropdownSource) return alignedNote
  return mismatchNote
}

/* ── Change Events ──────────────────────────────────────────────── */

const CHANGE_EVENTS_SCHEMA: PageSchemaEntry = {
  label: "Change Events",
  match: "change-events",
  tables: [
    {
      name: "change_events",
      description: "Main change event records. Tracks proposed changes to a project scope/budget.",
      columns: [
        { name: "id", type: "uuid", pk: true, notes: "Primary key" },
        { name: "project_id", type: "integer", fk: { table: "projects", column: "id" }, notes: "FK to projects (INTEGER, not UUID)" },
        { name: "number", type: "text", notes: "User-visible CE number (e.g. 'CE-001')" },
        { name: "title", type: "text", notes: "Required" },
        { name: "status", type: "text", notes: "Open, Pending Approval, Approved, Rejected, Closed, Void, Converted" },
        { name: "origin", type: "text", nullable: true },
        { name: "type", type: "text", nullable: true },
        { name: "scope", type: "text", nullable: true },
        { name: "reason", type: "text", nullable: true, notes: "Change reason" },
        { name: "description", type: "text", nullable: true },
        { name: "expecting_revenue", type: "boolean", notes: "Defaults to true. Controls revenue columns in line items." },
        { name: "line_item_revenue_source", type: "text", nullable: true },
        { name: "prime_contract_id", type: "integer", nullable: true, fk: { table: "prime_contracts", column: "id" } },
        { name: "created_by", type: "uuid", nullable: true, fk: { table: "auth.users", column: "id" } },
        { name: "updated_by", type: "uuid", nullable: true, fk: { table: "auth.users", column: "id" } },
        { name: "created_at", type: "timestamptz" },
        { name: "updated_at", type: "timestamptz" },
        { name: "deleted_at", type: "timestamptz", nullable: true, notes: "Soft delete" },
      ],
    },
    {
      name: "change_event_line_items",
      description: "Individual cost/revenue line items within a change event.",
      columns: [
        { name: "id", type: "uuid", pk: true },
        { name: "change_event_id", type: "uuid", fk: { table: "change_events", column: "id" } },
        {
          name: "budget_line_id",
          type: "uuid",
          nullable: true,
          fk: (() => {
            const fkTarget = getFkTarget("change_event_line_items", "budget_line_id", "budget_lines.id")
            const [table = "budget_lines", column = "id"] = fkTarget.split(".")
            return { table, column }
          })(),
          notes: "Preferred FK to budget_lines.id. Replaces legacy budget_code_id naming.",
        },
        {
          name: "budget_code_id",
          type: "uuid",
          nullable: true,
          fk: (() => {
            const fkTarget = getFkTarget("change_event_line_items", "budget_code_id", "budget_lines.id")
            const [table = "budget_lines", column = "id"] = fkTarget.split(".")
            return { table, column }
          })(),
          notes: "Legacy alias for budget_line_id. Stores budget_lines.id, not project_budget_codes.id.",
        },
        { name: "description", type: "text", nullable: true },
        {
          name: "vendor_id",
          type: "uuid",
          nullable: true,
          fk: (() => {
            const fkTarget = getFkTarget("change_event_line_items", "vendor_id", "vendors.id")
            const [table = "vendors", column = "id"] = fkTarget.split(".")
            return { table, column }
          })(),
          notes: getMismatchNote(
            getFkTarget("change_event_line_items", "vendor_id", "vendors.id"),
            "vendors.id",
            "⚠️ FK → vendors.id, but dropdown uses a different source.",
            "FK aligns with vendor dropdown source.",
          ),
        },
        { name: "contract_id", type: "integer", nullable: true },
        { name: "commitment_id", type: "uuid", nullable: true, notes: "Links to subcontracts or purchase_orders" },
        { name: "commitment_type", type: "text", nullable: true, notes: "'subcontract' or 'purchase_order'" },
        { name: "commitment_line_item_id", type: "uuid", nullable: true },
        { name: "quantity", type: "numeric", nullable: true },
        { name: "unit_of_measure", type: "text", nullable: true },
        { name: "unit_cost", type: "numeric", nullable: true },
        { name: "cost_rom", type: "numeric", nullable: true, notes: "Cost ROM (rough order of magnitude)" },
        { name: "revenue_rom", type: "numeric", nullable: true, notes: "Revenue ROM" },
        { name: "non_committed_cost", type: "numeric", nullable: true },
        { name: "sort_order", type: "integer", notes: "Display ordering" },
        { name: "created_at", type: "timestamptz" },
        { name: "updated_at", type: "timestamptz" },
      ],
    },
    {
      name: "change_event_history",
      description: "Audit log tracking field-level changes to change events.",
      columns: [
        { name: "id", type: "uuid", pk: true },
        { name: "change_event_id", type: "uuid", fk: { table: "change_events", column: "id" } },
        { name: "field_name", type: "text" },
        { name: "old_value", type: "text", nullable: true },
        { name: "new_value", type: "text", nullable: true },
        { name: "changed_by", type: "uuid", nullable: true, fk: { table: "auth.users", column: "id" } },
        { name: "change_type", type: "text", notes: "UPDATE, CREATE, etc." },
        { name: "created_at", type: "timestamptz" },
      ],
    },
    {
      name: "change_event_documents",
      description: "Pattern C document links for change event attachments.",
      columns: [
        { name: "id", type: "bigint", pk: true },
        { name: "change_event_id", type: "uuid", fk: { table: "change_events", column: "id" } },
        { name: "document_metadata_id", type: "text", fk: { table: "document_metadata", column: "id" } },
        { name: "document_type", type: "text", nullable: true },
        { name: "attached_by", type: "uuid", nullable: true, fk: { table: "auth.users", column: "id" } },
        { name: "attached_at", type: "timestamptz" },
      ],
    },
    {
      name: "change_event_related_items",
      description: "Links change events to other entities (RFIs, submittals, etc.).",
      columns: [
        { name: "id", type: "uuid", pk: true },
        { name: "change_event_id", type: "uuid", fk: { table: "change_events", column: "id" } },
        { name: "related_type", type: "text", notes: "Entity type (rfi, submittal, etc.)" },
        { name: "related_id", type: "text" },
        { name: "created_at", type: "timestamptz" },
      ],
    },
    {
      name: "budget_lines",
      description: "Budget line items. FK target for change_event_line_items.budget_line_id.",
      columns: [
        { name: "id", type: "uuid", pk: true },
        { name: "project_id", type: "integer", fk: { table: "projects", column: "id" } },
        { name: "cost_code_id", type: "uuid", fk: { table: "cost_codes", column: "id" }, notes: "Shared key with project_budget_codes" },
        { name: "cost_type_id", type: "uuid", nullable: true, notes: "Shared key with project_budget_codes" },
        { name: "description", type: "text", nullable: true },
        { name: "original_budget_amount", type: "numeric", nullable: true },
        { name: "created_at", type: "timestamptz" },
      ],
    },
    {
      name: "project_budget_codes",
      description: "Cost codes assigned to a project. Single source of truth for FK and dropdown. Supersedes the removed legacy project cost code table.",
      columns: [
        { name: "id", type: "uuid", pk: true, notes: "FK target for contract_line_items.budget_code_id, direct_cost_line_items.budget_code_id" },
        { name: "project_id", type: "integer", fk: { table: "projects", column: "id" } },
        { name: "cost_code_id", type: "text", fk: { table: "cost_codes", column: "id" } },
        { name: "cost_type_id", type: "uuid", nullable: true },
        { name: "description", type: "text" },
        { name: "created_at", type: "timestamptz" },
      ],
    },
    {
      name: "companies",
      description: "Company records.",
      columns: [
        { name: "id", type: "uuid", pk: true },
        { name: "name", type: "text" },
        { name: "status", type: "text", nullable: true, notes: "ACTIVE / INACTIVE" },
      ],
    },
    {
      name: "vendors",
      description: "Project-scoped vendor records. Dropdown source for vendor selection and FK target for change_event_line_items.vendor_id.",
      columns: [
        { name: "id", type: "uuid", pk: true, notes: "Stored directly in change_event_line_items.vendor_id" },
        { name: "company_id", type: "uuid", fk: { table: "companies", column: "id" } },
        { name: "project_id", type: "integer", nullable: true, fk: { table: "projects", column: "id" } },
      ],
    },
  ],
  apiRoutes: [
    { method: "GET", path: "/api/projects/[projectId]/change-events", description: "List all change events for a project" },
    { method: "POST", path: "/api/projects/[projectId]/change-events", description: "Create a new change event" },
    { method: "GET", path: "/api/projects/[projectId]/change-events/[changeEventId]", description: "Get change event detail" },
    { method: "PATCH", path: "/api/projects/[projectId]/change-events/[changeEventId]", description: "Update change event fields" },
    { method: "DELETE", path: "/api/projects/[projectId]/change-events/[changeEventId]", description: "Soft-delete a change event" },
    { method: "GET", path: "/api/projects/[projectId]/change-events/[changeEventId]/line-items", description: "List line items (with reverse-mapped IDs for dropdowns)" },
    { method: "POST", path: "/api/projects/[projectId]/change-events/[changeEventId]/line-items", description: "Create line item (resolves budget_code + vendor IDs)" },
    { method: "PUT", path: "/api/projects/[projectId]/change-events/[changeEventId]/line-items", description: "Bulk reorder line items" },
    { method: "GET", path: "/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]", description: "Get single line item" },
    { method: "PATCH", path: "/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]", description: "Update line item (resolves budget_code + vendor IDs)" },
    { method: "DELETE", path: "/api/projects/[projectId]/change-events/[changeEventId]/line-items/[lineItemId]", description: "Delete line item" },
    { method: "GET", path: "/api/projects/[projectId]/change-events/[changeEventId]/attachments", description: "List attachments" },
    { method: "POST", path: "/api/projects/[projectId]/change-events/[changeEventId]/attachments", description: "Upload attachments (multipart)" },
    { method: "GET", path: "/api/projects/[projectId]/change-events/[changeEventId]/related-items", description: "List related items" },
    { method: "POST", path: "/api/projects/[projectId]/change-events/[changeEventId]/related-items", description: "Link a related item" },
    { method: "DELETE", path: "/api/projects/[projectId]/change-events/[changeEventId]/related-items/[id]", description: "Unlink a related item" },
    { method: "GET", path: "/api/projects/[projectId]/change-events/validation", description: "Zod schemas for create/update" },
  ],
  fieldMappings: [
    // Change Event form fields
    { formField: "title", dbColumn: "title", dbTable: "change_events" },
    { formField: "number / contractNumber", dbColumn: "number", dbTable: "change_events" },
    { formField: "status", dbColumn: "status", dbTable: "change_events", notes: "Maps form values (open/close/pending/void) → DB values (Open/Closed/Pending Approval/Void)" },
    { formField: "origin", dbColumn: "origin", dbTable: "change_events" },
    { formField: "type", dbColumn: "type", dbTable: "change_events" },
    { formField: "changeReason", dbColumn: "reason", dbTable: "change_events", notes: "Form key ≠ DB column name" },
    { formField: "scope", dbColumn: "scope", dbTable: "change_events" },
    { formField: "expectingRevenue", dbColumn: "expecting_revenue", dbTable: "change_events", notes: "⚠️ API returns camelCase but DB is snake_case. Type needs both." },
    { formField: "lineItemRevenueSource", dbColumn: "line_item_revenue_source", dbTable: "change_events" },
    { formField: "primeContractId", dbColumn: "prime_contract_id", dbTable: "change_events" },
    { formField: "description", dbColumn: "description", dbTable: "change_events" },
    // Line item form fields
    {
      formField: "lineItems[].budgetCode",
      dbColumn: "budget_line_id",
      dbTable: "change_event_line_items",
      fkTarget: getFkTarget("change_event_line_items", "budget_line_id", "budget_lines.id"),
      dropdownSource: "project_budget_codes.id",
      notes: "API accepts a project_budget_codes.id from the form and stores the resolved budget_lines.id in budget_line_id.",
    },
    { formField: "lineItems[].description", dbColumn: "description", dbTable: "change_event_line_items" },
    {
      formField: "lineItems[].vendor",
      dbColumn: "vendor_id",
      dbTable: "change_event_line_items",
      fkTarget: getFkTarget("change_event_line_items", "vendor_id", "vendors.id"),
      dropdownSource: "vendors.id",
      notes: getMismatchNote(
        getFkTarget("change_event_line_items", "vendor_id", "vendors.id"),
        "vendors.id",
        "⚠️ FK MISMATCH — API resolves dropdown IDs before write.",
        "FK aligns with dropdown source.",
      ),
    },
    { formField: "lineItems[].contract", dbColumn: "commitment_id + commitment_type", dbTable: "change_event_line_items", notes: "Form stores 'sub-{id}' or 'po-{id}'. Parsed into commitment_id + commitment_type on save." },
    { formField: "lineItems[].commitmentLineItemId", dbColumn: "commitment_line_item_id", dbTable: "change_event_line_items" },
    { formField: "lineItems[].costQuantity", dbColumn: "quantity", dbTable: "change_event_line_items", notes: "Form has separate revenue/cost quantity but DB has one field" },
    { formField: "lineItems[].revenueUnitOfMeasure", dbColumn: "unit_of_measure", dbTable: "change_event_line_items" },
    { formField: "lineItems[].costUnitCost", dbColumn: "unit_cost", dbTable: "change_event_line_items" },
    { formField: "lineItems[].costRom", dbColumn: "cost_rom", dbTable: "change_event_line_items" },
    { formField: "lineItems[].revenueRom", dbColumn: "revenue_rom", dbTable: "change_event_line_items" },
    { formField: "lineItems[].nonCommittedCost", dbColumn: "non_committed_cost", dbTable: "change_event_line_items" },
  ],
}

/* ── Registry ───────────────────────────────────────────────────── */

const REGISTRY: PageSchemaEntry[] = [
  CHANGE_EVENTS_SCHEMA,
  // Add more tool schemas here as needed
]

/**
 * Find the matching schema entry for a given pathname.
 * Checks each route segment against the registry's match patterns.
 */
export function findPageSchema(pathname: string): PageSchemaEntry | null {
  const segments = pathname.split("/").filter(Boolean)
  for (const entry of REGISTRY) {
    const matches = Array.isArray(entry.match) ? entry.match : [entry.match]
    if (matches.some((m) => segments.includes(m))) {
      return entry
    }
  }
  return null
}
