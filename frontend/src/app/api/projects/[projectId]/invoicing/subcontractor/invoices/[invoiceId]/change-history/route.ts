import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

// GET → list audit log entries for this invoice, newest first
export const GET = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/change-history#GET",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { invoiceId } = params;
    const invoiceIdNum = parseInt(invoiceId, 10);

    const { data, error } = await supabase
      .from("subcontractor_invoice_audit_log")
      .select("*")
      .eq("invoice_id", invoiceIdNum)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch change history", details: error.message },
        { status: 500 },
      );
    }

    const rows = data ?? [];
    const actorUserIds = Array.from(
      new Set(
        rows
          .map((row) => row.actor_user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const profileByUserId = new Map<
      string,
      { email: string; full_name: string | null }
    >();

    if (actorUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name")
        .in("id", actorUserIds);

      if (profilesError) {
        return NextResponse.json(
          {
            error: "Failed to resolve change history users",
            details: profilesError.message,
          },
          { status: 500 },
        );
      }

      for (const profile of profiles ?? []) {
        profileByUserId.set(profile.id, {
          email: profile.email,
          full_name: profile.full_name,
        });
      }
    }

    const enrichedRows = rows.map((row) => {
      const profile = row.actor_user_id
        ? profileByUserId.get(row.actor_user_id)
        : undefined;

      return {
        ...row,
        actor_email: row.actor_email ?? profile?.email ?? null,
        actor_display_name:
          profile?.full_name ?? row.actor_email ?? profile?.email ?? null,
      };
    });

    return NextResponse.json({ data: enrichedRows });
    },
);
