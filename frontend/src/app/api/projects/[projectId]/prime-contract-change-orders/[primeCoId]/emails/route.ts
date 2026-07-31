import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const GET = withApiGuardrails<{
  projectId: string;
  primeCoId: string;
}>(
  "projects/[projectId]/prime-contract-change-orders/[primeCoId]/emails#GET",
  async ({ params }) => {
    const { projectId, primeCoId } = await params;
    const parsedProjectId = Number.parseInt(projectId, 10);

    if (!Number.isFinite(parsedProjectId)) {
      throw new GuardrailError({
        code: "BAD_REQUEST",
        where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/emails#GET",
        message: "Invalid project id.",
        status: 400,
      });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/prime-contract-change-orders/[primeCoId]/emails#GET",
        message: "Authentication required.",
      });
    }

    const { data: emails, error } = await supabase
      .from("project_emails")
      .select(
        "id, subject, from_email, from_name, body, status, sent_at, received_at, has_attachments, to_list, created_at",
      )
      .eq("project_id", parsedProjectId)
      .eq("related_tool", "prime-contract-change-order")
      .eq("related_id", primeCoId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: emails ?? [],
      meta: { total_count: emails?.length ?? 0 },
    });
  },
);
