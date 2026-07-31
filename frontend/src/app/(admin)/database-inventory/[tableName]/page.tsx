import { notFound } from "next/navigation";

import { RecordDetailPage } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { SchemaExplorerTableDetails } from "@/features/database-inventory/schema-explorer-table-details";
import { getSchemaExplorerInventory } from "@/features/database-inventory/schema-explorer.server";
import type { SchemaExplorerDatabase } from "@/features/database-inventory/schema-explorer.types";

export const dynamic = "force-dynamic";

function parseDatabase(
  value: string | undefined,
): SchemaExplorerDatabase | null {
  return value === "PM_APP" || value === "RAG" ? value : null;
}

export default async function DatabaseInventoryTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ tableName: string }>;
  searchParams: Promise<{ database?: string }>;
}) {
  const [{ tableName }, { database: databaseParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const database = parseDatabase(databaseParam);

  let name = "";
  try {
    name = decodeURIComponent(tableName);
  } catch {
    notFound();
  }

  if (!database) notFound();

  const inventory = await getSchemaExplorerInventory();
  const table = inventory.tables.find(
    (candidate) => candidate.database === database && candidate.name === name,
  );
  if (!table) notFound();

  return (
    <RecordDetailPage
      title={table.name}
      breadcrumbs={[
        { label: "Database Inventory", href: "/database-inventory" },
      ]}
      statusBadge={
        <Badge variant="outline" className="font-mono text-xs">
          {table.database === "PM_APP" ? "PM App" : "AI / RAG"}
        </Badge>
      }
    >
      <SchemaExplorerTableDetails table={table} />
    </RecordDetailPage>
  );
}
