import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import type {
  DbInventory,
  DbInventoryTable,
} from "@/components/dev-tools/db-inventory.generated";

async function requireAdmin() {
  const user = await getApiRouteUser();
  if (!user) return null;
    const { data } = await serviceDb.from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data?.is_admin ? user : null;
}

interface RefreshUpdate {
  name: string;
  db: "MAIN" | "RAG";
  approxRows: number;
  totalSize: string;
  lastAutoanalyze: string | null;
}

const DB_INVENTORY_JSON_PATH = path.join(
  process.cwd(),
  "src/components/dev-tools/db-inventory.generated.json",
);

function assertDbInventoryShape(payload: unknown): asserts payload is DbInventory {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { tables?: unknown }).tables)
  ) {
    throw new GuardrailError({
      code: "SCHEMA_MISMATCH",
      where: "/api/admin/db-inventory/refresh#loadDbInventory",
      message: "Database inventory artifact is malformed.",
      details: {
        path: DB_INVENTORY_JSON_PATH,
      },
      status: 500,
    });
  }
}

async function loadDbInventory(): Promise<DbInventory> {
  let raw = "";
  try {
    raw = await readFile(DB_INVENTORY_JSON_PATH, "utf8");
  } catch (error) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where: "/api/admin/db-inventory/refresh#loadDbInventory",
      message: "Database inventory artifact is missing.",
      details: {
        path: DB_INVENTORY_JSON_PATH,
        reason: error instanceof Error ? error.message : String(error),
      },
      status: 500,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: "/api/admin/db-inventory/refresh#loadDbInventory",
      message: "Database inventory artifact contains invalid JSON.",
      details: {
        path: DB_INVENTORY_JSON_PATH,
        reason: error instanceof Error ? error.message : String(error),
      },
      status: 500,
    });
  }

  assertDbInventoryShape(parsed);
  return parsed;
}

// This route returns stats from the last generator run.
// For true live counts, re-run `npm run db:inventory`.
export const POST = withApiGuardrails(
  "/api/admin/db-inventory/refresh#POST",
  async ({ request }) => {
    const user = await requireAdmin();
    if (!user) {
      throw new GuardrailError({
        code: "FORBIDDEN",
        where: "/api/admin/db-inventory/refresh#POST",
        message: "Admin access required.",
        status: 403,
      });
    }

    const body = (await request.json().catch(() => ({}))) as { tables?: string[] };
    const requestedNames = body.tables ?? null;

    const inventory = await loadDbInventory();
    const allTables = inventory.tables;
    const targetTables = requestedNames
      ? allTables.filter((t: DbInventoryTable) => requestedNames.includes(t.name))
      : allTables;

    if (targetTables.length === 0) {
      return NextResponse.json({ refreshedAt: new Date().toISOString(), updates: [] });
    }

    // Return current stats from the generated file.
    // The generated file is refreshed by npm run db:inventory.
    // A more expensive live query could be added here later via a server-side pg client.
    const updates: RefreshUpdate[] = targetTables.map((t) => ({
      name: t.name,
      db: t.db,
      approxRows: t.liveStats.approxRows,
      totalSize: t.liveStats.totalSize,
      lastAutoanalyze: t.liveStats.lastAutoanalyze,
    }));

    return NextResponse.json({
      refreshedAt: new Date().toISOString(),
      updates,
    });
  },
);
