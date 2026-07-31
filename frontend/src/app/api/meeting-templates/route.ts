export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const WHERE_GET = "meeting-templates#GET";

// GET: Name+id only, for the create-meeting template dropdown. Any
// authenticated user may read — write access is admin-only (see
// /api/admin/meeting-templates).
export const GET = withApiGuardrails(WHERE_GET, async () => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: WHERE_GET,
      message: "Authentication required.",
    });
  }

  const supabase = await createClient();

  const { data: templateRows, error } = await supabase
    .from("meeting_templates")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: WHERE_GET,
      message: `Failed to load meeting templates: ${error.message}`,
      details: error,
    });
  }

  return NextResponse.json({ templates: templateRows ?? [] });
});
