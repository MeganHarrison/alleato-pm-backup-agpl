import "server-only";

import { z } from "zod";

import {
  DB_INVENTORY,
  type DbInventoryTable,
} from "@/components/dev-tools/db-inventory.generated";
import { GuardrailError } from "@/lib/guardrails/errors";
import {
  createRagServiceClient,
  createServiceClient,
} from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import type {
  SchemaExplorerDatabase,
  SchemaExplorerInventory,
  SchemaExplorerTable,
} from "./schema-explorer.types";

const WHERE = "api.admin.db-inventory.refresh#schema-metadata";
const RPC_NAME = "get_schema_explorer_metadata";

type SchemaExplorerDescriptionOverride = {
  databaseKey: SchemaExplorerDatabase;
  tableName: string;
  description: string;
};

type SchemaExplorerStewardshipOverride = {
  databaseKey: SchemaExplorerDatabase;
  tableName: string;
  ownerName: string | null;
  lastReviewedAt: string | null;
};

const rawSchemaExplorerTable = z.object({
  name: z.string().min(1),
  columns: z.array(
    z.object({
      name: z.string().min(1),
      dataType: z.string().min(1),
      isNullable: z.boolean(),
      isPrimaryKey: z.boolean(),
    }),
  ),
  primaryKeyColumns: z.array(z.string()),
  foreignKeys: z.array(
    z.object({
      name: z.string().min(1),
      columns: z.array(z.string()).min(1),
      referencedSchema: z.string().min(1),
      referencedTable: z.string().min(1),
      referencedColumns: z.array(z.string()).min(1),
    }),
  ),
});

const rawSchemaExplorerMetadata = z.object({
  schema: z.literal("public"),
  generatedAt: z.string(),
  tables: z.array(rawSchemaExplorerTable),
});

type SchemaExplorerRpcClient = {
  rpc: (name: typeof RPC_NAME) => Promise<{
    data: unknown;
    error: { code: string; message: string } | null;
  }>;
};

function annotationFor(
  database: SchemaExplorerDatabase,
  tableName: string,
): DbInventoryTable | undefined {
  const db = database === "PM_APP" ? "MAIN" : "RAG";
  return DB_INVENTORY.tables.find(
    (table) => table.db === db && table.name === tableName,
  );
}

function inferPurpose(tableName: string): string {
  return `No curated purpose has been recorded for ${tableName}. This table is shown from the live public schema; inspect its foreign keys and code references before assigning ownership or making cleanup decisions.`;
}

function descriptionFor(
  database: SchemaExplorerDatabase,
  tableName: string,
  annotation: DbInventoryTable | undefined,
  overrides: ReadonlyMap<string, string>,
): string {
  return (
    overrides.get(`${database}:${tableName}`) ??
    annotation?.purpose ??
    inferPurpose(tableName)
  );
}

async function loadDescriptionOverrides(): Promise<Map<string, string>> {
  const { data, error } = await serviceDb
    .from("schema_explorer_table_descriptions")
    .select("database_key, table_name, description");

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message:
        "Database Inventory descriptions are unavailable. Apply the schema_explorer_table_descriptions migration, then refresh.",
      details: { reason: error.message },
    });
  }

  return new Map(
    (data ?? []).map((row) => [
      `${row.database_key}:${row.table_name}`,
      row.description,
    ]),
  );
}

async function loadStewardshipOverrides(): Promise<
  Map<
    string,
    Pick<SchemaExplorerStewardshipOverride, "ownerName" | "lastReviewedAt">
  >
> {
  const { data, error } = await serviceDb
    .from("schema_explorer_table_stewardship")
    .select("database_key, table_name, owner_name, last_reviewed_at");

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: WHERE,
      message:
        "Database Inventory stewardship is unavailable. Apply the schema_explorer_table_stewardship migration, then refresh.",
      details: { reason: error.message },
    });
  }

  return new Map(
    (data ?? []).map((row) => [
      `${row.database_key}:${row.table_name}`,
      {
        ownerName: row.owner_name,
        lastReviewedAt: row.last_reviewed_at,
      },
    ]),
  );
}

function featureConnections(annotation: DbInventoryTable | undefined) {
  if (!annotation) {
    return [
      {
        label:
          "No curated feature connection is recorded yet. This does not establish that the table is unused.",
        provenance: "inferred" as const,
      },
    ];
  }

  const connections = [
    {
      label: `${annotation.domain.replaceAll("_", " ")} feature area`,
      provenance: "curated" as const,
    },
  ];

  const paths = [
    ...annotation.references.reads,
    ...annotation.references.writes,
  ]
    .map((reference) => reference.filePath)
    .filter((path, index, all) => all.indexOf(path) === index)
    .slice(0, 3);

  for (const path of paths) {
    connections.push({ label: path, provenance: "code-derived" as const });
  }

  return connections;
}

export function mergeSchemaMetadata(
  database: SchemaExplorerDatabase,
  raw: z.infer<typeof rawSchemaExplorerMetadata>,
  descriptionOverrides: ReadonlyMap<string, string> = new Map(),
  stewardshipOverrides: ReadonlyMap<
    string,
    Pick<SchemaExplorerStewardshipOverride, "ownerName" | "lastReviewedAt">
  > = new Map(),
): SchemaExplorerTable[] {
  return raw.tables.map((table) => {
    const annotation = annotationFor(database, table.name);
    const relatedTables = new Set([
      ...(annotation?.relatedTables ?? []),
      ...table.foreignKeys.map((foreignKey) => foreignKey.referencedTable),
    ]);
    const stewardship = stewardshipOverrides.get(`${database}:${table.name}`);

    return {
      ...table,
      database,
      schema: raw.schema,
      description: descriptionFor(
        database,
        table.name,
        annotation,
        descriptionOverrides,
      ),
      ownerName: stewardship?.ownerName ?? null,
      lastReviewedAt: stewardship?.lastReviewedAt ?? null,
      purpose: annotation?.purpose ?? inferPurpose(table.name),
      purposeProvenance: annotation ? "curated" : "inferred",
      featureConnections: featureConnections(annotation),
      relatedTables: [...relatedTables].sort(),
      references: annotation?.references ?? {
        writes: [],
        reads: [],
        migrations: [],
        unknown: [],
      },
    };
  });
}

async function loadSource(
  database: SchemaExplorerDatabase,
  client: SchemaExplorerRpcClient,
  descriptionOverrides: ReadonlyMap<string, string>,
  stewardshipOverrides: ReadonlyMap<
    string,
    Pick<SchemaExplorerStewardshipOverride, "ownerName" | "lastReviewedAt">
  >,
): Promise<{ generatedAt: string; tables: SchemaExplorerTable[] }> {
  const { data, error } = await client.rpc(RPC_NAME);
  if (error) {
    throw new GuardrailError({
      code:
        error.code === "PGRST202" ? "PRECONDITION_FAILED" : "INTERNAL_ERROR",
      where: WHERE,
      status: error.code === "PGRST202" ? 503 : undefined,
      message:
        error.code === "PGRST202"
          ? `Live schema metadata is unavailable for ${database}. Apply its get_schema_explorer_metadata migration, then refresh.`
          : `Unable to load ${database} schema metadata: ${error.message}`,
      details: { database, code: error.code },
    });
  }

  const parsed = rawSchemaExplorerMetadata.safeParse(data);
  if (!parsed.success) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where: WHERE,
      message: `Live schema metadata for ${database} did not match the explorer contract.`,
      details: parsed.error.issues,
    });
  }

  return {
    generatedAt: parsed.data.generatedAt,
    tables: mergeSchemaMetadata(
      database,
      parsed.data,
      descriptionOverrides,
      stewardshipOverrides,
    ),
  };
}

export async function getSchemaExplorerInventory(): Promise<SchemaExplorerInventory> {
  const [descriptionOverrides, stewardshipOverrides] = await Promise.all([
    loadDescriptionOverrides(),
    loadStewardshipOverrides(),
  ]);
  const main = await loadSource(
    "PM_APP",
    createServiceClient() as unknown as SchemaExplorerRpcClient,
    descriptionOverrides,
    stewardshipOverrides,
  );

  const rag = await loadSource(
    "RAG",
    createRagServiceClient() as unknown as SchemaExplorerRpcClient,
    descriptionOverrides,
    stewardshipOverrides,
  ).then(
    (result) => ({ available: true as const, ...result }),
    (error: unknown) => ({
      available: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Unable to load RAG schema metadata.",
      generatedAt: null,
      tables: [],
    }),
  );

  return {
    generatedAt: main.generatedAt,
    tables: [...main.tables, ...rag.tables].sort((a, b) =>
      a.database === b.database
        ? a.name.localeCompare(b.name)
        : a.database.localeCompare(b.database),
    ),
    sources: [
      { database: "PM_APP", available: true },
      ...(rag.available
        ? [{ database: "RAG" as const, available: true }]
        : [
            {
              database: "RAG" as const,
              available: false,
              message: rag.message,
            },
          ]),
    ],
  };
}

async function assertSchemaExplorerTableExists(
  databaseKey: SchemaExplorerDatabase,
  tableName: string,
) {
  // Validation must stay independent of optional metadata overlays: an outage
  // in stewardship cannot prevent an existing description from being saved.
  const source = await loadSource(
    databaseKey,
    (databaseKey === "PM_APP"
      ? createServiceClient()
      : createRagServiceClient()) as unknown as SchemaExplorerRpcClient,
    new Map(),
    new Map(),
  );
  const tableExists = source.tables.some((table) => table.name === tableName);

  if (!tableExists) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "api.admin.db-inventory.stewardship",
      message: `Table ${databaseKey}.${tableName} is not present in the live inventory. Refresh and try again.`,
      status: 404,
    });
  }
}

export function buildOwnerStewardshipUpsert(
  databaseKey: SchemaExplorerDatabase,
  tableName: string,
  ownerName: string | null,
  updatedAt: string,
) {
  // Omitting last_reviewed_at tells PostgREST's conflict update to retain the
  // review evidence already stored for the row.
  return {
    database_key: databaseKey,
    table_name: tableName,
    owner_name: ownerName,
    updated_at: updatedAt,
  };
}

export function buildReviewStewardshipUpsert(
  databaseKey: SchemaExplorerDatabase,
  tableName: string,
  reviewedAt: string,
) {
  // Omitting owner_name keeps ownership intact on conflict while creating an
  // unassigned row when review evidence is recorded first.
  return {
    database_key: databaseKey,
    table_name: tableName,
    last_reviewed_at: reviewedAt,
    updated_at: reviewedAt,
  };
}

export async function updateSchemaExplorerTableDescription({
  databaseKey,
  tableName,
  description,
}: SchemaExplorerDescriptionOverride): Promise<{ description: string }> {
  await assertSchemaExplorerTableExists(databaseKey, tableName);

  const { error } = await serviceDb
    .from("schema_explorer_table_descriptions")
    .upsert(
      {
        database_key: databaseKey,
        table_name: tableName,
        description,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "database_key,table_name" },
    );

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "api.admin.db-inventory.descriptions#PUT",
      message: `Unable to save the description for ${databaseKey}.${tableName}: ${error.message}`,
      details: { reason: error.message },
    });
  }

  return { description };
}

export async function updateSchemaExplorerTableOwner({
  databaseKey,
  tableName,
  ownerName,
}: Omit<SchemaExplorerStewardshipOverride, "lastReviewedAt">): Promise<
  Pick<SchemaExplorerStewardshipOverride, "ownerName" | "lastReviewedAt">
> {
  await assertSchemaExplorerTableExists(databaseKey, tableName);
  const updatedAt = new Date().toISOString();
  const { data, error } = await serviceDb
    .from("schema_explorer_table_stewardship")
    .upsert(
      buildOwnerStewardshipUpsert(databaseKey, tableName, ownerName, updatedAt),
      { onConflict: "database_key,table_name" },
    )
    .select("owner_name, last_reviewed_at")
    .single();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "api.admin.db-inventory.stewardship#PUT",
      message: `Unable to save the owner for ${databaseKey}.${tableName}: ${error.message}`,
      details: { reason: error.message },
    });
  }

  return {
    ownerName: data.owner_name,
    lastReviewedAt: data.last_reviewed_at,
  };
}

export async function markSchemaExplorerTableReviewed({
  databaseKey,
  tableName,
}: Pick<
  SchemaExplorerStewardshipOverride,
  "databaseKey" | "tableName"
>): Promise<
  Pick<SchemaExplorerStewardshipOverride, "ownerName" | "lastReviewedAt">
> {
  await assertSchemaExplorerTableExists(databaseKey, tableName);
  const lastReviewedAt = new Date().toISOString();
  const { data, error } = await serviceDb
    .from("schema_explorer_table_stewardship")
    .upsert(
      buildReviewStewardshipUpsert(databaseKey, tableName, lastReviewedAt),
      { onConflict: "database_key,table_name" },
    )
    .select("owner_name, last_reviewed_at")
    .single();

  if (error) {
    throw new GuardrailError({
      code: "UPSTREAM_FAILURE",
      where: "api.admin.db-inventory.stewardship#POST",
      message: `Unable to mark ${databaseKey}.${tableName} reviewed: ${error.message}`,
      details: { reason: error.message },
    });
  }

  return {
    ownerName: data.owner_name,
    lastReviewedAt: data.last_reviewed_at,
  };
}
