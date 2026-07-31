import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { apiErrorResponse } from "@/lib/api-error";
import { asPlaneCyclesDb } from "@/features/plane-cycles-domain/server-db";
import {
  getPlaneCycleStatus,
  withPlaneCycleStatus,
} from "@/features/plane-cycles-domain/model";
import { authorizePlaneCycles } from "./access";
import {
  CreateCycleSchema,
  CycleQuerySchema,
  isValidCycleDateRange,
  UpdateCycleSchema,
} from "./contracts";

function validationError(where: string, details: unknown) {
  return new GuardrailError({
    code: "VALIDATION_ERROR",
    where,
    message: "Invalid cycle request.",
    status: 400,
    details,
  });
}

export const GET = withApiGuardrails(
  "plane-cycles#GET",
  async ({ request }) => {
    const query = CycleQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success) {
      throw validationError("plane-cycles#GET", query.error.flatten());
    }

    const authorization = await authorizePlaneCycles(
      query.data.projectId,
      "read",
    );
    if (authorization instanceof NextResponse) return authorization;

    const db = asPlaneCyclesDb(authorization.serviceClient);
    let builder = db
      .from("project_cycles")
      .select("*")
      .eq("project_id", query.data.projectId)
      .order("sort_order")
      .order("created_at", { ascending: false });

    if (query.data.cycleId) {
      builder = builder.eq("id", query.data.cycleId);
    }
    builder =
      query.data.cycleView === "archived"
        ? builder.not("archived_at", "is", null)
        : builder.is("archived_at", null);

    const { data, error } = await builder;
    if (error) return apiErrorResponse(error);

    const cycles = (data ?? [])
      .map(withPlaneCycleStatus)
      .filter(
        (cycle) =>
          query.data.cycleView === "all" ||
          getPlaneCycleStatus(cycle) === query.data.cycleView,
      );

    if (query.data.cycleId && cycles.length === 0) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }

    return NextResponse.json({ cycles });
  },
);

export const POST = withApiGuardrails(
  "plane-cycles#POST",
  async ({ request }) => {
    const parsed = CreateCycleSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw validationError("plane-cycles#POST", parsed.error.flatten());
    }

    const authorization = await authorizePlaneCycles(
      parsed.data.project_id,
      "write",
    );
    if (authorization instanceof NextResponse) return authorization;

    const db = asPlaneCyclesDb(authorization.serviceClient);
    const { data, error } = await db
      .from("project_cycles")
      .insert({
        project_id: parsed.data.project_id,
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        start_date: parsed.data.start_date ?? null,
        end_date: parsed.data.end_date ?? null,
        owned_by: parsed.data.owned_by ?? authorization.user.id,
        timezone: parsed.data.timezone ?? "UTC",
        sort_order: 65_535,
        view_props: {},
        progress_snapshot: {},
        external_source: parsed.data.external_source ?? null,
        external_id: parsed.data.external_id ?? null,
        archived_at: null,
        created_by: authorization.user.id,
        updated_by: authorization.user.id,
      })
      .select("*")
      .single();

    if (error) return apiErrorResponse(error);
    return NextResponse.json(
      { cycle: withPlaneCycleStatus(data) },
      { status: 201 },
    );
  },
);

export const PATCH = withApiGuardrails(
  "plane-cycles#PATCH",
  async ({ request }) => {
    const parsed = UpdateCycleSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw validationError("plane-cycles#PATCH", parsed.error.flatten());
    }

    const authorization = await authorizePlaneCycles(
      parsed.data.project_id,
      "write",
    );
    if (authorization instanceof NextResponse) return authorization;

    const db = asPlaneCyclesDb(authorization.serviceClient);
    const { data: current, error: currentError } = await db
      .from("project_cycles")
      .select("*")
      .eq("id", parsed.data.cycle_id)
      .eq("project_id", parsed.data.project_id)
      .maybeSingle();
    if (currentError) return apiErrorResponse(currentError);
    if (!current) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }

    const startDate =
      parsed.data.start_date === undefined
        ? current.start_date
        : parsed.data.start_date;
    const endDate =
      parsed.data.end_date === undefined
        ? current.end_date
        : parsed.data.end_date;
    if (!isValidCycleDateRange(startDate, endDate)) {
      throw validationError("plane-cycles#PATCH", {
        start_date: startDate,
        end_date: endDate,
      });
    }

    const { project_id: _projectId, cycle_id: _cycleId, ...updates } =
      parsed.data;
    const { data, error } = await db
      .from("project_cycles")
      .update({
        ...updates,
        updated_by: authorization.user.id,
      })
      .eq("id", parsed.data.cycle_id)
      .eq("project_id", parsed.data.project_id)
      .select("*")
      .maybeSingle();

    if (error) return apiErrorResponse(error);
    if (!data) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }
    return NextResponse.json({ cycle: withPlaneCycleStatus(data) });
  },
);

export const DELETE = withApiGuardrails(
  "plane-cycles#DELETE",
  async ({ request }) => {
    const query = CycleQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!query.success || !query.data.cycleId) {
      throw validationError(
        "plane-cycles#DELETE",
        query.success ? { cycleId: "Cycle ID is required." } : query.error.flatten(),
      );
    }

    const authorization = await authorizePlaneCycles(
      query.data.projectId,
      "write",
    );
    if (authorization instanceof NextResponse) return authorization;

    const db = asPlaneCyclesDb(authorization.serviceClient);
    const { data, error } = await db
      .from("project_cycles")
      .delete()
      .eq("id", query.data.cycleId)
      .eq("project_id", query.data.projectId)
      .select("id")
      .maybeSingle();

    if (error) return apiErrorResponse(error);
    if (!data) {
      return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  },
);
