import { requireAdmin } from "@/app/api/admin/_shared";
import { getSchemaExplorerInventory } from "@/features/database-inventory/schema-explorer.server";
import { withApiGuardrails } from "@/lib/guardrails/api";

export const dynamic = "force-dynamic";

const WHERE = "api.admin.db-inventory.refresh#GET";

/**
 * Live, metadata-only schema inventory. The underlying RPC is service-role-only;
 * this route adds the Admin Dashboard authorization boundary before calling it.
 */
async function loadInventory(): Promise<Response> {
  await requireAdmin(WHERE);
  return Response.json(await getSchemaExplorerInventory(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export const GET = withApiGuardrails(WHERE, loadInventory);

// Preserve the existing refresh action while making it a fresh live metadata read.
export const POST = withApiGuardrails(
  "api.admin.db-inventory.refresh#POST",
  loadInventory,
);
