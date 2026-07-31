import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";
import { computeLineFinancials } from "@/lib/invoicing/payment-application";

// PATCH /api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/line-items
// Bulk-update editable SOV fields on line items of a draft / revise_and_resubmit invoice.
// Accepts: { updates: Array<{
//   id: number;
//   work_completed_period?: number;
//   materials_stored?: number;
//   retainage_pct?: number;
//   materials_retainage_pct?: number;
//   work_retainage_released?: number;   // amount of work retainage to release this period
//   materials_retainage_released?: number; // amount of materials retainage to release this period
// }> }
// Server recomputes derived totals (pct, total, work_retainage_amount, materials_retainage_amount, balance, net).
//
// IMPORTANT: work_retainage_amount = thisPeriod * workRetainagePct / 100
// NOT (previous + thisPeriod) * pct. "Work Retainage This Period" applies only
// to work completed in the current billing period. Prior periods' retainage is
// already tracked in previous_work_retainage and carried forward separately.
export const PATCH = withApiGuardrails<{ projectId: string; invoiceId: string }>(
  "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/line-items#PATCH",
  async ({ request, params }) => {
  
    const supabase = await createClient();
    const { projectId, invoiceId } = params;

    const user = await getApiRouteUser();
    const authError = null as Error | null;

    if (authError) {
      return NextResponse.json(
        { error: "Authentication failed", details: authError.message },
        { status: 401 },
      );
    }
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/line-items#PATCH", message: "Authentication required." });
    }

    const projectIdNum = parseInt(projectId, 10);
    const invoiceIdNum = parseInt(invoiceId, 10);

    const body = await request.json().catch(() => null);
    const updates = Array.isArray(body?.updates) ? body.updates : null;
    if (!updates || updates.length === 0) {
      return NextResponse.json(
        { error: "updates array is required" },
        { status: 400 },
      );
    }

    // Verify invoice exists and is editable
    const { data: invoice, error: fetchError } = await supabase
      .from("subcontractor_invoices")
      .select("id, status")
      .eq("id", invoiceIdNum)
      .eq("project_id", projectIdNum)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Invoice not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Failed to verify invoice", details: fetchError.message },
        { status: 500 },
      );
    }

    if (!["draft", "invited", "revise_and_resubmit"].includes(invoice.status)) {
      return NextResponse.json(
        {
          error:
            "Line items can only be edited when the invoice is Draft, Invited, or Revise & Resubmit",
        },
        { status: 400 },
      );
    }

    // Fetch all impacted rows up front so we can recompute derived values
    const ids = updates
      .map((u: { id: unknown }) => Number(u.id))
      .filter((n: number) => Number.isFinite(n));

    const { data: existingRows, error: rowsError } = await supabase
      .from("subcontractor_invoice_line_items")
      .select(
        "id, invoice_id, scheduled_value, work_completed_previous, work_completed_period, materials_stored, retainage_pct, materials_retainage_pct, previous_work_retainage, previous_materials_retainage, retainage_amount, materials_retainage_amount, work_retainage_released, materials_retainage_released",
      )
      .in("id", ids)
      .eq("invoice_id", invoiceIdNum);

    if (rowsError) {
      return NextResponse.json(
        { error: "Failed to load line items", details: rowsError.message },
        { status: 500 },
      );
    }

    const rowById = new Map(existingRows?.map((r) => [r.id, r]) ?? []);

    const results: Array<{ id: number; ok: boolean; error?: string }> = [];
    for (const patch of updates) {
      const id = Number(patch.id);
      const existing = rowById.get(id);
      if (!existing) {
        results.push({ id, ok: false, error: "Line item not on this invoice" });
        continue;
      }

      const scheduled = Number(existing.scheduled_value) || 0;
      const previous = Number(existing.work_completed_previous) || 0;
      const thisPeriod =
        patch.work_completed_period !== undefined
          ? Number(patch.work_completed_period) || 0
          : Number(existing.work_completed_period) || 0;
      const stored =
        patch.materials_stored !== undefined
          ? Number(patch.materials_stored) || 0
          : Number(existing.materials_stored) || 0;
      const workRetainagePct =
        patch.retainage_pct !== undefined
          ? Number(patch.retainage_pct) || 0
          : Number(existing.retainage_pct) || 0;
      const materialsRetainagePct =
        patch.materials_retainage_pct !== undefined
          ? Number(patch.materials_retainage_pct) || 0
          : Number(existing.materials_retainage_pct) || 0;

      // Retainage release amounts (capped at total currently withheld)
      const prevWorkRetained = Number(existing.previous_work_retainage) || 0;
      const prevMatRetained = Number(existing.previous_materials_retainage) || 0;

      // total_completed_stored, balance_to_finish, and net_amount_this_period are
      // GENERATED ALWAYS columns in Postgres — do not write them. The payment-application
      // module owns the derived per-line math (retainage this period, % complete, release
      // caps). "Retainage this period" applies only to work billed this period; previous
      // periods' retainage is carried in previous_work_retainage independently.
      const fin = computeLineFinancials({
        scheduled_value: scheduled,
        work_completed_previous: previous,
        work_completed_period: thisPeriod,
        materials_stored: stored,
        retainage_pct: workRetainagePct,
        materials_retainage_pct: materialsRetainagePct,
        previous_work_retainage: prevWorkRetained,
        previous_materials_retainage: prevMatRetained,
      });
      const workCompletedPct = fin.work_completed_pct;
      const workRetainageAmount = fin.retainage_amount;
      const materialsRetainageAmount = fin.materials_retainage_amount;
      // Maximum releasable = withheld in prior periods + withheld this period.
      const maxWorkReleasable = fin.max_work_releasable;
      const maxMatReleasable = fin.max_materials_releasable;

      let workRetainageReleased =
        patch.work_retainage_released !== undefined
          ? Number(patch.work_retainage_released) || 0
          : Number(existing.work_retainage_released) || 0;
      let materialsRetainageReleased =
        patch.materials_retainage_released !== undefined
          ? Number(patch.materials_retainage_released) || 0
          : Number(existing.materials_retainage_released) || 0;

      // Guard: cannot release more than what was withheld
      if (workRetainageReleased > maxWorkReleasable) {
        results.push({
          id,
          ok: false,
          error: `Work retainage released (${workRetainageReleased}) exceeds total withheld (${maxWorkReleasable.toFixed(2)})`,
        });
        continue;
      }
      if (materialsRetainageReleased > maxMatReleasable) {
        results.push({
          id,
          ok: false,
          error: `Materials retainage released (${materialsRetainageReleased}) exceeds total withheld (${maxMatReleasable.toFixed(2)})`,
        });
        continue;
      }
      if (workRetainageReleased < 0) workRetainageReleased = 0;
      if (materialsRetainageReleased < 0) materialsRetainageReleased = 0;

      const { error: updateError } = await supabase
        .from("subcontractor_invoice_line_items")
        .update({
          work_completed_period: thisPeriod,
          materials_stored: stored,
          retainage_pct: workRetainagePct,
          retainage_amount: workRetainageAmount,
          materials_retainage_pct: materialsRetainagePct,
          materials_retainage_amount: materialsRetainageAmount,
          work_retainage_released: workRetainageReleased,
          materials_retainage_released: materialsRetainageReleased,
          work_completed_pct: workCompletedPct,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        results.push({ id, ok: false, error: updateError.message });
      } else {
        results.push({ id, ok: true });
        await supabase.from("subcontractor_invoice_audit_log").insert({
          invoice_id: invoiceIdNum,
          actor_user_id: user.id,
          actor_email: user.email ?? null,
          event_type: "line_item.updated",
          field_name: `line_item_${id}`,
          old_value: {
            work_completed_period: Number(existing.work_completed_period) || 0,
            materials_stored: Number(existing.materials_stored) || 0,
            retainage_pct: Number(existing.retainage_pct) || 0,
            materials_retainage_pct: Number(existing.materials_retainage_pct) || 0,
            work_retainage_released: Number(existing.work_retainage_released) || 0,
            materials_retainage_released: Number(existing.materials_retainage_released) || 0,
          },
          new_value: {
            work_completed_period: thisPeriod,
            materials_stored: stored,
            retainage_pct: workRetainagePct,
            materials_retainage_pct: materialsRetainagePct,
            retainage_amount: workRetainageAmount,
            materials_retainage_amount: materialsRetainageAmount,
            work_retainage_released: workRetainageReleased,
            materials_retainage_released: materialsRetainageReleased,
          },
        });
      }
    }

    const allOk = results.every((r) => r.ok);
    return NextResponse.json(
      { data: { results }, message: allOk ? "Line items updated" : "Some updates failed" },
      { status: allOk ? 200 : 207 },
    );
    },
);
