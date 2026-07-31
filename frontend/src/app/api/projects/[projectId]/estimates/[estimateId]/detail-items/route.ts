import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const GET = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/detail-items#GET",
  async ({ params }) => {
    const { estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "detail-items#GET", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "detail-items#GET",
        message: "Invalid estimate ID.",
        details: { estimateId },
      });
    }

    const { data, error } = await supabase
      .from("estimate_detail_items")
      .select("*")
      .eq("estimate_id", estimateIdNum)
      .order("division_code", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "detail-items#GET",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data ?? []);
  }
);

export const POST = withApiGuardrails<{ projectId: string; estimateId: string }>(
  "projects/[projectId]/estimates/[estimateId]/detail-items#POST",
  async ({ request, params }) => {
    const { estimateId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "detail-items#POST", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    if (isNaN(estimateIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "detail-items#POST",
        message: "Invalid estimate ID.",
        details: { estimateId },
      });
    }

    const body = await request.json();

    if (Array.isArray(body.items)) {
      const rows = body.items.map((item: Record<string, unknown>, idx: number) => ({
        estimate_id: estimateIdNum,
        division_code: item.division_code ?? "02",
        division_name: item.division_name ?? "",
        cost_code: item.cost_code ?? null,
        cost_type: item.cost_type ?? null,
        cost_code_name: item.cost_code_name ?? null,
        work_description: item.work_description ?? null,
        estimated_amount: item.estimated_amount ?? 0,
        sub_name: item.sub_name ?? null,
        sort_order: item.sort_order ?? idx + 1,
      }));

      if (rows.length === 0) {
        return NextResponse.json([], { status: 201 });
      }

      const { data, error } = await supabase
        .from("estimate_detail_items")
        .insert(rows)
        .select()
        .order("division_code", { ascending: true })
        .order("sort_order", { ascending: true });

      if (error) {
        throw new GuardrailError({
          code: "DB_ERROR",
          where: "detail-items#POST",
          message: error.message,
          cause: error,
        });
      }

      return NextResponse.json(data ?? [], { status: 201 });
    }

    const {
      division_code,
      division_name,
      cost_code,
      cost_type,
      cost_code_name,
      work_description,
      estimated_amount,
      sub_name,
      sort_order,
    } = body;

    const { data, error } = await supabase
      .from("estimate_detail_items")
      .insert({
        estimate_id: estimateIdNum,
        division_code: division_code ?? "02",
        division_name: division_name ?? "",
        cost_code: cost_code ?? null,
        cost_type: cost_type ?? null,
        cost_code_name: cost_code_name ?? null,
        work_description: work_description ?? null,
        estimated_amount: estimated_amount ?? 0,
        sub_name: sub_name ?? null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "detail-items#POST",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
