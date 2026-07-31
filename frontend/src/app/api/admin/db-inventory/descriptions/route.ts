import { z } from "zod";

import { requireAdmin } from "@/app/api/admin/_shared";
import { updateSchemaExplorerTableDescription } from "@/features/database-inventory/schema-explorer.server";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";

const WHERE = "api.admin.db-inventory.descriptions#PUT";

const descriptionSchema = z.object({
  database: z.enum(["PM_APP", "RAG"]),
  tableName: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().trim().min(1).max(2000),
});

export const PUT = withApiGuardrails(WHERE, async ({ request }) => {
  await requireAdmin(WHERE);
  const body = await parseJsonBody(request, descriptionSchema, WHERE);

  return Response.json(
    await updateSchemaExplorerTableDescription({
      databaseKey: body.database,
      tableName: body.tableName,
      description: body.description,
    }),
  );
});
