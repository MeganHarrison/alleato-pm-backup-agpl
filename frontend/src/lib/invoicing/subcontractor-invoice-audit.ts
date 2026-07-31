import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export type SubcontractorInvoiceStatus =
  Database["public"]["Enums"]["invoice_status"];

type Actor = {
  id: string;
  email?: string | null;
};

type StampStatusAuditActorArgs = {
  supabase: SupabaseClient<Database>;
  invoiceId: number;
  fromStatus: SubcontractorInvoiceStatus;
  toStatus: SubcontractorInvoiceStatus;
  transitionStartedAt: string;
  actor: Actor;
};

type StampStatusAuditActorResult =
  | { ok: true; auditLogId: number }
  | { ok: false; reason: string };

export async function stampSubcontractorInvoiceStatusAuditActor({
  supabase,
  invoiceId,
  fromStatus,
  toStatus,
  transitionStartedAt,
  actor,
}: StampStatusAuditActorArgs): Promise<StampStatusAuditActorResult> {
  const { data: auditRows, error: findError } = await supabase
    .from("subcontractor_invoice_audit_log")
    .select("id, old_value, new_value, created_at, actor_user_id")
    .eq("invoice_id", invoiceId)
    .eq("event_type", "status.changed")
    .eq("field_name", "status")
    .order("created_at", { ascending: false })
    .limit(10);

  if (findError) {
    return { ok: false, reason: findError.message };
  }

  const transitionStarted = new Date(transitionStartedAt).getTime();
  const auditRow = (auditRows ?? []).find((row) => {
    const createdAt = new Date(row.created_at).getTime();
    return (
      Number.isFinite(createdAt) &&
      createdAt >= transitionStarted &&
      row.old_value === fromStatus &&
      row.new_value === toStatus
    );
  });

  if (!auditRow) {
    return {
      ok: false,
      reason: `No status audit row found for invoice ${invoiceId} transition ${fromStatus} -> ${toStatus}.`,
    };
  }

  if (auditRow.actor_user_id) {
    return { ok: true, auditLogId: auditRow.id };
  }

  const { error: updateError } = await supabase
    .from("subcontractor_invoice_audit_log")
    .update({
      actor_user_id: actor.id,
      actor_email: actor.email || null,
    })
    .eq("id", auditRow.id)
    .is("actor_user_id", null);

  if (updateError) {
    return { ok: false, reason: updateError.message };
  }

  return { ok: true, auditLogId: auditRow.id };
}
