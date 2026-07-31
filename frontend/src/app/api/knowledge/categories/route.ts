export const dynamic = "force-dynamic";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// GET /api/knowledge/categories — distinct category values for knowledge-base docs
// Returns: { data: string[] }
// ---------------------------------------------------------------------------

export const GET = withApiGuardrails(
  "knowledge/categories#GET",
  async () => {
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "knowledge/categories#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("document_metadata")
      .select("category")
      .eq("type", "knowledge-base")
      .not("category", "is", null);

    if (error) {
      throw new GuardrailError({
        code: "UPSTREAM_FAILURE",
        where: "knowledge/categories#GET",
        message: "Failed to load knowledge categories.",
        cause: error.message,
      });
    }

    const unique = [
      ...new Set(
        (data ?? [])
          .map((r) => r.category as string)
          .filter(Boolean),
      ),
    ].sort();

    return NextResponse.json({ data: unique });
  },
);
