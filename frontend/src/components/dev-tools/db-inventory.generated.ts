// AUTO-GENERATED — DO NOT EDIT BY HAND.
// Regenerate with: npm run db:inventory
// Source: docs/architecture/tables.yaml + live Supabase (MAIN + RAG) + codebase grep.
// Generated: 2026-07-24T06:42:03.140Z

import inventoryJson from "./db-inventory.generated.json";

export type DbInventoryStatus =
  | "active"
  | "blocked"
  | "dead"
  | "dormant"
  | "legacy"
  | "live"
  | "live-empty"
  | "orphan-mirror";

export type DbInventoryDomain =
  | "admin"
  | "ai"
  | "auth"
  | "change_management"
  | "communications"
  | "crm"
  | "design-system"
  | "directory"
  | "documents"
  | "estimating"
  | "executive"
  | "financial"
  | "fm-asrs"
  | "infrastructure"
  | "intelligence"
  | "marketing"
  | "meetings"
  | "ops"
  | "permissions"
  | "pipeline"
  | "progress_reports"
  | "project_intelligence"
  | "projects"
  | "schedule"
  | "support"
  | "unknown"
  | "workflow";

export type DbInventoryReference = {
  filePath: string;
  lineNumber: number;
  kind: "read" | "write" | "migration" | "unknown";
  snippet: string;
};

export type DbInventoryTable = {
  name: string;
  db: "MAIN" | "RAG";
  domain: DbInventoryDomain;
  status: DbInventoryStatus;
  purpose: string;
  gotchas: string | null;
  cleanupPriority: "low" | "medium" | "high" | null;
  owner: string;
  relatedTables: string[];
  notesForAi: string | null;
  liveStats: {
    approxRows: number;
    totalSize: string;
    lastAutoanalyze: string | null;
    nLiveTup: number;
    nDeadTup: number;
    refreshedAt: string;
  };
  columns: Array<{
    name: string;
    dataType: string;
    isNullable: boolean;
  }>;
  references: {
    writes: DbInventoryReference[];
    reads: DbInventoryReference[];
    migrations: DbInventoryReference[];
    unknown: DbInventoryReference[];
  };
};

export type DbInventory = {
  generatedAt: string;
  generatorVersion: "1";
  tables: DbInventoryTable[];
};

export const DB_INVENTORY: DbInventory = inventoryJson as DbInventory;
