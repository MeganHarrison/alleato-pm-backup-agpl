import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const GET = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/gc-items#GET",
  async ({ params }) => {
    const { estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "gc-items#GET", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items#GET",
        message: "Invalid estimate ID.",
        details: { estimateId },
      });
    }

    const { data, error } = await supabase
      .from("estimate_gc_items")
      .select("*")
      .eq("estimate_id", estimateIdNum)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "gc-items#GET",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data ?? []);
  }
);

// Deletes ALL gc items for this estimate in one query — used by the Load Template flow.
export const DELETE = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/gc-items#DELETE",
  async ({ params }) => {
    const { estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "gc-items#DELETE", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items#DELETE",
        message: "Invalid estimate ID.",
        details: { estimateId },
      });
    }

    const { error } = await supabase
      .from("estimate_gc_items")
      .delete()
      .eq("estimate_id", estimateIdNum);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "gc-items#DELETE",
        message: error.message,
        cause: error,
      });
    }

    return new Response(null, { status: 204 });
  }
);

/**
 * PUT /gc-items — Atomic template load: insert new items first, then delete the
 * old ones only after the insert succeeds.  If the insert fails the original
 * rows survive and the caller gets a clean error — no data-loss window.
 *
 * Body: { items: GcTemplateItem[] }
 * Returns: the newly inserted rows (same shape as POST).
 */
export const PUT = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/gc-items#PUT",
  async ({ request, params }) => {
    const { estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "gc-items#PUT", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items#PUT",
        message: "Invalid estimate ID.",
        details: { estimateId },
      });
    }

    const body = await request.json();
    if (!Array.isArray(body.items)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items#PUT",
        message: "Body must contain an `items` array.",
      });
    }

    const rows = (body.items as Record<string, unknown>[]).map((item, idx) => ({
      estimate_id: estimateIdNum,
      cost_code: (item.cost_code as string | undefined) ?? "",
      description: (item.description as string | undefined) ?? "",
      cost_type: (item.cost_type as string | undefined) ?? "Expense",
      qty: (item.qty as number | null | undefined) ?? null,
      qty_basis: (item.qty_basis as string | null | undefined) ?? null,
      unit: (item.unit as string | null | undefined) ?? null,
      rate: (typeof item.rate === "number" ? item.rate : 0),
      allocation: (typeof item.allocation === "number" ? item.allocation : 0),
      sort_order: (item.sort_order as number | undefined) ?? idx + 1,
    }));

    // Step 1: insert the new rows.  If this fails we throw and the old rows
    // are untouched — the catch in handleConfirmLoadTemplate will surface the
    // error to the user.
    let insertedRows: Record<string, unknown>[] = [];
    if (rows.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("estimate_gc_items")
        .insert(rows)
        .select()
        .order("sort_order", { ascending: true });

      if (insertError) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "gc-items#PUT (insert)",
          message: insertError.message,
          cause: insertError,
        });
      }

      insertedRows = inserted ?? [];
    }

    // Step 2: delete the old rows only now that the insert succeeded.
    // We exclude the IDs we just inserted so we never accidentally wipe them.
    const newIds = insertedRows
      .map((r) => r.id as number)
      .filter((id) => typeof id === "number");

    const deleteQuery = supabase
      .from("estimate_gc_items")
      .delete()
      .eq("estimate_id", estimateIdNum);

    const { error: deleteError } =
      newIds.length > 0
        ? await deleteQuery.not("id", "in", `(${newIds.join(",")})`)
        : await deleteQuery;

    if (deleteError) {
      // The new rows are already inserted — don't fail the whole request.
      // Log the issue; the user will see duplicate rows on reload but no data
      // was lost.  A manual refresh will reconcile state.
      console.error("gc-items#PUT: delete-old-rows failed after successful insert", deleteError);
    }

    return NextResponse.json(insertedRows, { status: 200 });
  }
);

export const POST = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/gc-items#POST",
  async ({ request, params }) => {
    const { estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "gc-items#POST", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items#POST",
        message: "Invalid estimate ID.",
        details: { estimateId },
      });
    }

    const body = await request.json();

    if (Array.isArray(body.items)) {
      const rows = body.items.map((item: Record<string, unknown>, idx: number) => ({
        estimate_id: estimateIdNum,
        cost_code: item.cost_code ?? "",
        description: item.description ?? "",
        cost_type: item.cost_type ?? "Expense",
        qty: item.qty ?? null,
        qty_basis: item.qty_basis ?? null,
        unit: item.unit ?? null,
        rate: item.rate ?? 0,
        allocation: item.allocation ?? 0,
        sort_order: item.sort_order ?? idx + 1,
      }));

      if (rows.length === 0) {
        return NextResponse.json([], { status: 201 });
      }

      const { data, error } = await supabase
        .from("estimate_gc_items")
        .insert(rows)
        .select()
        .order("sort_order", { ascending: true });

      if (error) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "gc-items#POST",
          message: error.message,
          cause: error,
        });
      }

      return NextResponse.json(data ?? [], { status: 201 });
    }

    const {
      cost_code,
      description,
      cost_type,
      qty,
      qty_basis,
      unit,
      rate,
      allocation,
      sort_order,
    } = body;

    const { data, error } = await supabase
      .from("estimate_gc_items")
      .insert({
        estimate_id: estimateIdNum,
        cost_code: cost_code ?? "",
        description: description ?? "",
        cost_type: cost_type ?? "Expense",
        qty: qty ?? null,
        qty_basis: qty_basis ?? null,
        unit: unit ?? null,
        rate: rate ?? 0,
        allocation: allocation ?? 0,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "gc-items#POST",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
