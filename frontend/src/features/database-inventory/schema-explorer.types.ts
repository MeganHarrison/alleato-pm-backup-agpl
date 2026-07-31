export type SchemaExplorerDatabase = "PM_APP" | "RAG";

export type SchemaExplorerColumn = {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
};

export type SchemaExplorerForeignKey = {
  name: string;
  columns: string[];
  referencedSchema: string;
  referencedTable: string;
  referencedColumns: string[];
};

export type SchemaExplorerReference = {
  filePath: string;
  lineNumber: number;
  kind: "read" | "write" | "migration" | "unknown";
  snippet: string;
};

export type SchemaExplorerFeatureConnection = {
  label: string;
  provenance: "curated" | "code-derived" | "inferred";
};

export type SchemaExplorerTable = {
  name: string;
  database: SchemaExplorerDatabase;
  schema: string;
  columns: SchemaExplorerColumn[];
  primaryKeyColumns: string[];
  foreignKeys: SchemaExplorerForeignKey[];
  description: string;
  ownerName: string | null;
  lastReviewedAt: string | null;
  purpose: string;
  purposeProvenance: "curated" | "inferred";
  featureConnections: SchemaExplorerFeatureConnection[];
  relatedTables: string[];
  references: {
    writes: SchemaExplorerReference[];
    reads: SchemaExplorerReference[];
    migrations: SchemaExplorerReference[];
    unknown: SchemaExplorerReference[];
  };
};

export type SchemaExplorerSourceStatus = {
  database: SchemaExplorerDatabase;
  available: boolean;
  message?: string;
};

export type SchemaExplorerInventory = {
  generatedAt: string;
  tables: SchemaExplorerTable[];
  sources: SchemaExplorerSourceStatus[];
};
