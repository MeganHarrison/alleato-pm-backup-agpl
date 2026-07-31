import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const GET = withApiGuardrails(
  "table-metadata#GET",
  async () => {
  
    // Use authenticated client — table_metadata requires a logged-in user.
    // OWASP A01:2021 - Broken Access Control: removed unauthenticated service client.
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "table-metadata#GET", message: "Authentication required." });
    }

    const { data, error } = await supabase
      .from("table_metadata")
      .select("*")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });

    if (error) {
      logger.error({ msg: "Error fetching table metadata:", error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: "Failed to fetch table metadata" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
    },
);
