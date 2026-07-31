/**
 * Entity Links — Table Map
 *
 * Single source of truth for the 8 Tier-1 link tables introduced in Phase 2.
 * The naming convention is alphabetical: {entity_a}_{entity_b}_links.
 *
 * Given a pair of entity types, this module resolves:
 *   - Which Supabase table to query
 *   - Which FK column corresponds to each entity type
 *
 * If a pair is not found, the entity types are invalid or not linked in Tier 1.
 *
 * Rules:
 *  - project_documents and project_photos use bigint PKs
 *  - All other entities use uuid PKs
 *  - Column name is always the entity type + "_id" (with "project_" prefix kept for documents/photos)
 */

export type EntityType =
  | "rfi"
  | "submittal"
  | "change_event"
  | "drawing"
  | "document"
  | "photo"
  | "punch_item"
  | "observation"
  | "daily_log";

/** All 8 Tier-1 link table names */
export type LinkTableName =
  | "documents_rfis_links"
  | "documents_submittals_links"
  | "change_events_documents_links"
  | "project_photos_punch_items_links"
  | "observations_project_photos_links"
  | "daily_logs_project_photos_links"
  | "drawings_rfis_links"
  | "rfis_submittals_links";

/** Maps an entity type to its FK column name in link tables */
export const ENTITY_FK_COLUMN: Record<EntityType, string> = {
  rfi: "rfi_id",
  submittal: "submittal_id",
  change_event: "change_event_id",
  drawing: "drawing_id",
  document: "project_document_id",
  photo: "project_photo_id",
  punch_item: "punch_item_id",
  observation: "observation_id",
  daily_log: "daily_log_id",
};

/** The Supabase table where each entity's records live */
export const ENTITY_SOURCE_TABLE: Record<EntityType, string> = {
  rfi: "rfis",
  submittal: "submittals",
  change_event: "change_events",
  drawing: "drawings",
  document: "project_documents",
  photo: "project_photos",
  punch_item: "punch_items",
  observation: "observations",
  daily_log: "daily_logs",
};

/** Human-readable label for each entity type */
export const ENTITY_LABEL: Record<EntityType, string> = {
  rfi: "RFI",
  submittal: "Submittal",
  change_event: "Change Event",
  drawing: "Drawing",
  document: "Document",
  photo: "Photo",
  punch_item: "Punch Item",
  observation: "Observation",
  daily_log: "Daily Log",
};

/**
 * Describes one side of a link table entry.
 */
export interface LinkTableSpec {
  /** The Supabase table name */
  table: LinkTableName;
  /** FK column for the "source" entity (the one we're viewing) */
  sourceColumn: string;
  /** FK column for the "target" entity (the other side) */
  targetColumn: string;
  /** The entity type for the target side */
  targetType: EntityType;
}

/**
 * Given a source entity type, returns all link specs that involve that entity.
 * Each spec describes: which table, which column is "mine", which is the other side.
 *
 * For an RFI, we get:
 *   - documents_rfis_links  (rfi_id = mine, project_document_id = other)
 *   - drawings_rfis_links   (rfi_id = mine, drawing_id = other)
 *   - rfis_submittals_links (rfi_id = mine, submittal_id = other)
 */
export function getLinkSpecsForEntity(entityType: EntityType): LinkTableSpec[] {
  const specs: LinkTableSpec[] = [];

  for (const [pair, tableName] of Object.entries(LINK_TABLE_MAP)) {
    const [a, b] = pair.split("|") as [EntityType, EntityType];
    if (a === entityType) {
      specs.push({
        table: tableName,
        sourceColumn: ENTITY_FK_COLUMN[a],
        targetColumn: ENTITY_FK_COLUMN[b],
        targetType: b,
      });
    } else if (b === entityType) {
      specs.push({
        table: tableName,
        sourceColumn: ENTITY_FK_COLUMN[b],
        targetColumn: ENTITY_FK_COLUMN[a],
        targetType: a,
      });
    }
  }

  return specs;
}

/**
 * Given a source+target pair, returns the link table spec or null if no direct link exists.
 * Order of arguments does not matter — the map is bidirectional.
 */
export function getLinkSpec(
  sourceType: EntityType,
  targetType: EntityType,
): LinkTableSpec | null {
  // Try source|target
  const key1 = `${sourceType}|${targetType}` as `${EntityType}|${EntityType}`;
  const table1 = LINK_TABLE_MAP[key1];
  if (table1) {
    return {
      table: table1,
      sourceColumn: ENTITY_FK_COLUMN[sourceType],
      targetColumn: ENTITY_FK_COLUMN[targetType],
      targetType,
    };
  }

  // Try target|source (reverse)
  const key2 = `${targetType}|${sourceType}` as `${EntityType}|${EntityType}`;
  const table2 = LINK_TABLE_MAP[key2];
  if (table2) {
    return {
      table: table2,
      sourceColumn: ENTITY_FK_COLUMN[sourceType],
      targetColumn: ENTITY_FK_COLUMN[targetType],
      targetType,
    };
  }

  return null;
}

/**
 * Internal map: "entityA|entityB" → table name.
 * Keys use the alphabetical order from the migration, but lookup is bidirectional.
 */
const LINK_TABLE_MAP: Partial<Record<`${EntityType}|${EntityType}`, LinkTableName>> = {
  // documents_rfis_links: project_documents <-> rfis
  "document|rfi": "documents_rfis_links",
  // documents_submittals_links: project_documents <-> submittals
  "document|submittal": "documents_submittals_links",
  // change_events_documents_links: change_events <-> project_documents
  "change_event|document": "change_events_documents_links",
  // project_photos_punch_items_links: project_photos <-> punch_items
  "photo|punch_item": "project_photos_punch_items_links",
  // observations_project_photos_links: observations <-> project_photos
  "observation|photo": "observations_project_photos_links",
  // daily_logs_project_photos_links: daily_logs <-> project_photos
  "daily_log|photo": "daily_logs_project_photos_links",
  // drawings_rfis_links: drawings <-> rfis
  "drawing|rfi": "drawings_rfis_links",
  // rfis_submittals_links: rfis <-> submittals
  "rfi|submittal": "rfis_submittals_links",
};

/** All valid entity types that can be linked from a given entity */
export const LINKABLE_TARGETS: Record<EntityType, EntityType[]> = {
  rfi: ["document", "drawing", "submittal"],
  submittal: ["document", "rfi"],
  change_event: ["document"],
  drawing: ["rfi"],
  document: ["rfi", "submittal", "change_event"],
  photo: ["punch_item", "observation", "daily_log"],
  punch_item: ["photo"],
  observation: ["photo"],
  daily_log: ["photo"],
};

/** The link_type check constraint values */
export const LINK_TYPES = [
  "related",
  "attachment",
  "reference",
  "supersedes",
  "causes",
  "blocks",
] as const;

export type LinkType = (typeof LINK_TYPES)[number];
