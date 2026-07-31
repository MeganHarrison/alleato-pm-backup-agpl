export const dynamic = "force-dynamic";

/**
 * DELETE /api/entity-links/[linkId]?table={tableName}
 *
 * Removes a link record from the specified link table.
 * The `table` query param must be one of the 8 Tier-1 link table names.
 * This prevents SQL injection by validating against an allowlist.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { LinkTableName } from "@/lib/entity-links/table-map";

const VALID_TABLES: LinkTableName[] = [
  "documents_rfis_links",
  "documents_submittals_links",
  "change_events_documents_links",
  "project_photos_punch_items_links",
  "observations_project_photos_links",
  "daily_logs_project_photos_links",
  "drawings_rfis_links",
  "rfis_submittals_links",
];

const deleteSchema = z.object({
  table: z.enum(VALID_TABLES as [LinkTableName, ...LinkTableName[]]),
  linkId: z.string().uuid("linkId must be a valid UUID"),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  try {
    const user = await getApiRouteUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "AUTH_EXPIRED", error_message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { linkId } = await params;
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    const parsed = deleteSchema.safeParse({ table, linkId });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid parameters",
          details: parsed.error.flatten().fieldErrors,
          hint: `'table' must be one of: ${VALID_TABLES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error, count } = await supabase
      .from(parsed.data.table as never)
      .delete({ count: "exact" })
      .eq("id", parsed.data.linkId);

    if (error) {
      return NextResponse.json(
        { error: `Failed to delete link: ${error.message}` },
        { status: 500 },
      );
    }

    if (count === 0) {
      return NextResponse.json(
        {
          error:
            "Link not found or you do not have permission to delete it. Only the creator can delete a link.",
        },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[entity-links DELETE] unhandled error:", err);
    return apiErrorResponse(err);
  }
}
