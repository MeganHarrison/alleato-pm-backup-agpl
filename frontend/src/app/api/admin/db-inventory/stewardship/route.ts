import { z } from "zod";

import { requireAdmin } from "@/app/api/admin/_shared";
import {
  markSchemaExplorerTableReviewed,
  updateSchemaExplorerTableOwner,
} from "@/features/database-inventory/schema-explorer.server";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";

const ownerSchema = z.object({
  database: z.enum(["PM_APP", "RAG"]),
  tableName: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/),
  ownerName: z.string().trim().max(160),
});

const reviewSchema = ownerSchema.pick({ database: true, tableName: true });

export const PUT = withApiGuardrails(
  "api.admin.db-inventory.stewardship#PUT",
  async ({ request }) => {
    await requireAdmin("api.admin.db-inventory.stewardship#PUT");
    const body = await parseJsonBody(
      request,
      ownerSchema,
      "api.admin.db-inventory.stewardship#PUT",
    );
    return Response.json(
      await updateSchemaExplorerTableOwner({
        databaseKey: body.database,
        tableName: body.tableName,
        ownerName: body.ownerName || null,
      }),
    );
  },
);

export const POST = withApiGuardrails(
  "api.admin.db-inventory.stewardship#POST",
  async ({ request }) => {
    await requireAdmin("api.admin.db-inventory.stewardship#POST");
    const body = await parseJsonBody(
      request,
      reviewSchema,
      "api.admin.db-inventory.stewardship#POST",
    );
    return Response.json(
      await markSchemaExplorerTableReviewed({
        databaseKey: body.database,
        tableName: body.tableName,
      }),
    );
  },
);
