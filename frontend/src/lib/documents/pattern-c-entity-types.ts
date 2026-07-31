/**
 * Client-safe Pattern C entity contract.
 *
 * This is the single runtime registry for attachment entity types. Keep this
 * module free of database, service-client, and workflow imports so client
 * components can feature-detect attachment support without pulling the
 * server-only document pipeline into the browser bundle.
 */
export type PatternCJunctionTable =
  | "project_documents_v2"
  | "subcontract_documents"
  | "purchase_order_documents"
  | "prime_contract_documents"
  | "change_order_documents"
  | "commitment_change_order_documents"
  | "prime_contract_change_order_documents"
  | "prime_contract_pco_documents"
  | "change_event_documents"
  | "owner_invoice_documents"
  | "subcontractor_invoice_documents"
  | "submittal_doc_links"
  | "rfi_documents"
  | "company_documents"
  | "crm_deal_documents"
  | "meeting_documents"
  | "meeting_item_documents";

export type PatternCConfig = {
  table: PatternCJunctionTable;
  fkColumn: string;
  storageFolder: string;
  /**
   * Junction-row timestamp column. Every original Pattern C table uses
   * `attached_at`; the meetings junction tables (`meeting_documents`,
   * `meeting_item_documents`) use the plain `created_at` convention instead
   * (no `document_type`/`attached_by` columns). Defaults to `attached_at`.
   */
  timestampColumn?: "attached_at" | "created_at";
  /** Junction-row actor column. Defaults to `attached_by`. */
  actorColumn?: "attached_by" | "created_by" | "attached_by_person_id";
  /** Whether the junction table has a `document_type` column. Defaults to true. */
  supportsDocumentType?: boolean;
};

export const PATTERN_C_ENTITY_CONFIG = {
  project: {
    table: "project_documents_v2",
    fkColumn: "project_id",
    storageFolder: "project",
  },
  subcontract: {
    table: "subcontract_documents",
    fkColumn: "subcontract_id",
    storageFolder: "subcontract",
  },
  purchase_order: {
    table: "purchase_order_documents",
    fkColumn: "purchase_order_id",
    storageFolder: "purchase-order",
  },
  prime_contract: {
    table: "prime_contract_documents",
    fkColumn: "prime_contract_id",
    storageFolder: "prime-contract",
  },
  change_order: {
    table: "change_order_documents",
    fkColumn: "change_order_id",
    storageFolder: "change-order",
  },
  commitment_change_order: {
    table: "commitment_change_order_documents",
    fkColumn: "commitment_change_order_id",
    storageFolder: "commitment-change-order",
  },
  prime_contract_change_order: {
    table: "prime_contract_change_order_documents",
    fkColumn: "prime_contract_change_order_id",
    storageFolder: "prime-contract-change-order",
  },
  prime_contract_pco: {
    table: "prime_contract_pco_documents",
    fkColumn: "pco_id",
    storageFolder: "prime-contract-pco",
  },
  change_event: {
    table: "change_event_documents",
    fkColumn: "change_event_id",
    storageFolder: "change-event",
  },
  invoice: {
    table: "owner_invoice_documents",
    fkColumn: "owner_invoice_id",
    storageFolder: "owner-invoice",
  },
  subcontractor_invoice: {
    table: "subcontractor_invoice_documents",
    fkColumn: "subcontractor_invoice_id",
    storageFolder: "subcontractor-invoice",
  },
  submittal: {
    table: "submittal_doc_links",
    fkColumn: "submittal_id",
    storageFolder: "submittal",
  },
  rfi: {
    table: "rfi_documents",
    fkColumn: "rfi_id",
    storageFolder: "rfi",
  },
  company: {
    table: "company_documents",
    fkColumn: "company_id",
    storageFolder: "company",
  },
  crm_deal: {
    table: "crm_deal_documents",
    fkColumn: "deal_id",
    storageFolder: "crm-deal",
    actorColumn: "attached_by_person_id",
  },
  meeting: {
    table: "meeting_documents",
    fkColumn: "meeting_id",
    storageFolder: "meeting",
    timestampColumn: "created_at",
    actorColumn: "created_by",
    supportsDocumentType: false,
  },
  meeting_item: {
    table: "meeting_item_documents",
    fkColumn: "meeting_item_id",
    storageFolder: "meeting-item",
    timestampColumn: "created_at",
    actorColumn: "created_by",
    supportsDocumentType: false,
  },
} as const satisfies Record<string, PatternCConfig>;

export type PatternCEntityType = keyof typeof PATTERN_C_ENTITY_CONFIG;

export function isPatternCEntityType(
  value: string,
): value is PatternCEntityType {
  return Object.prototype.hasOwnProperty.call(PATTERN_C_ENTITY_CONFIG, value);
}
