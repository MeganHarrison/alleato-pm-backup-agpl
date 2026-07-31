/**
 * RFI API Route (Collection-Level)
 *
 * GET /api/projects/[projectId]/rfis - List RFIs with filters
 * POST /api/projects/[projectId]/rfis - Create new RFI
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { notifyRfiOpened } from "@/lib/rfi/rfi-notify";
import { rfiDraftSchema, rfiOpenSchema } from "@/lib/schemas/rfi-schema";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ projectId: string }>;
};

/**
 * GET /api/projects/[projectId]/rfis
 * List RFIs with filtering, pagination, and search
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/rfis#GET",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/rfis#GET",
        message: "Authentication required.",
      });
    }
    const { searchParams } = new URL(request.url);

    const numericProjectId = Number(projectId);
    if (isNaN(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid projectId" },
        { status: 400 },
      );
    }

    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "200");

    // Column filters (Procore parity). Each maps to a rfis column; person fields
    // store display names, so exact-match by name except ball_in_court which is a
    // comma-joined string (substring match).
    const rfiManager = searchParams.get("rfi_manager");
    const assignee = searchParams.get("assignee");
    const receivedFrom = searchParams.get("received_from");
    const responsibleContractor = searchParams.get("responsible_contractor");
    const ballInCourt = searchParams.get("ball_in_court");
    const rfiStage = searchParams.get("rfi_stage");
    const overdue = searchParams.get("overdue");

    let query = supabase
      .from("rfis")
      .select("*", { count: "exact" })
      .eq("project_id", numericProjectId)
      .order("number", { ascending: false });

    if (status) {
      const statuses = status.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq("status", statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in("status", statuses);
      }
    }

    if (rfiManager) query = query.eq("rfi_manager", rfiManager);
    if (assignee) query = query.contains("assignees", [assignee]);
    if (receivedFrom) query = query.eq("received_from", receivedFrom);
    if (responsibleContractor)
      query = query.eq("responsible_contractor", responsibleContractor);
    if (ballInCourt) query = query.ilike("ball_in_court", `%${ballInCourt}%`);
    if (rfiStage) query = query.eq("rfi_stage", rfiStage);
    if (overdue === "true") {
      const today = new Date().toISOString().slice(0, 10);
      query = query
        .lt("due_date", today)
        .in("status", ["draft", "open", "answered"]);
    }

    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,question.ilike.%${search}%`,
      );
    }

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const [{ data, error, count }, { data: statusCounts }] = await Promise.all([
      query,
      supabase
        .from("rfis")
        .select("status")
        .eq("project_id", numericProjectId),
    ]);

    if (error) {
      logger.error({ msg: "RFI list error:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    const openStatuses = new Set(["draft", "open", "answered"]);
    const closedStatuses = new Set(["closed", "closed-draft"]);
    let openCount = 0;
    let closedCount = 0;
    for (const row of statusCounts ?? []) {
      if (openStatuses.has(row.status)) openCount++;
      else if (closedStatuses.has(row.status)) closedCount++;
    }
    const allCount = statusCounts?.length ?? 0;

    return NextResponse.json({
      data: data || [],
      meta: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
        tab_counts: {
          all: allCount,
          open: openCount,
          closed: closedCount,
        },
      },
    });
    },
);

/**
 * POST /api/projects/[projectId]/rfis
 * Create a new RFI
 */
export const POST = withApiGuardrails(
  "projects/[projectId]/rfis#POST",
  async ({ request, params }) => {
  
    const { projectId } = await params;
    const supabase = await createClient();
    const body = await request.json();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/rfis#POST", message: "Authentication required." });
    }

    const numericProjectId = Number(projectId);
    if (isNaN(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid projectId" },
        { status: 400 },
      );
    }

    // Use appropriate schema based on status
    const targetStatus = body.status || "draft";
    const schema = targetStatus === "draft" ? rfiDraftSchema : rfiOpenSchema;

    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation error", issues: result.error.flatten() },
        { status: 400 },
      );
    }

    // Get next RFI number for this project
    const { data: lastRfi } = await supabase
      .from("rfis")
      .select("number")
      .eq("project_id", numericProjectId)
      .order("number", { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (lastRfi?.number ?? 0) + 1;
    const rfiNumber = result.data.number ?? nextNumber;

    if (result.data.number !== undefined) {
      const { data: existingRfi, error: numberLookupError } = await supabase
        .from("rfis")
        .select("id")
        .eq("project_id", numericProjectId)
        .eq("number", rfiNumber)
        .maybeSingle();

      if (numberLookupError) {
        logger.error({
          msg: "RFI number availability check failed",
          projectId: numericProjectId,
          rfiNumber,
          error: numberLookupError instanceof Error ? numberLookupError.message : String(numberLookupError),
        });
        return apiErrorResponse(numberLookupError);
      }

      if (existingRfi) {
        return NextResponse.json(
          {
            error: `RFI number ${rfiNumber} is already in use for this project. Choose another number or leave the field empty for automatic numbering.`,
            code: "RFI_NUMBER_CONFLICT",
          },
          { status: 409 },
        );
      }
    }

    // Prepare insert data
    const insertData = {
      project_id: numericProjectId,
      number: rfiNumber,
      subject: result.data.subject,
      question: result.data.question || "",
      status: targetStatus,
      due_date: result.data.due_date || null,
      assignees: result.data.assignees || [],
      rfi_manager: result.data.rfi_manager || null,
      received_from: result.data.received_from || null,
      responsible_contractor: result.data.responsible_contractor || null,
      distribution_list: result.data.distribution_list || [],
      location: result.data.location || null,
      specification: result.data.specification || null,
      cost_code: result.data.cost_code || null,
      schedule_impact: result.data.schedule_impact || null,
      cost_impact: result.data.cost_impact || null,
      reference: result.data.reference || null,
      is_private: result.data.is_private || false,
      rfi_stage: result.data.rfi_stage || null,
      drawing_number: result.data.drawing_number || null,
      created_by: user.email || user.id,
      date_initiated: new Date().toISOString().split("T")[0],
      ball_in_court:
        targetStatus === "open" && result.data.assignees?.length
          ? result.data.assignees.join(", ")
          : null,
    };

    const { data, error } = await supabase
      .from("rfis")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: `RFI number ${rfiNumber} is already in use for this project. Choose another number or leave the field empty for automatic numbering.`,
            code: "RFI_NUMBER_CONFLICT",
          },
          { status: 409 },
        );
      }
      logger.error({ msg: "RFI create error:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // An RFI created directly as "open" is distributed immediately. The row is
    // already saved, so a notification failure surfaces as a non-blocking
    // warning rather than failing the create (which succeeded).
    if (targetStatus === "open") {
      const notificationResult = await notifyRfiOpened({
        projectId: numericProjectId,
        rfiId: String(data.id),
        actorUserId: user.id,
      });

      if (notificationResult.failed.length > 0) {
        logger.warn({
          msg: "RFI created (open) but distribution email(s) failed",
          rfiId: data.id,
          failed: notificationResult.failed,
        });
        return NextResponse.json(
          {
            ...data,
            _emailWarning:
              "RFI created, but one or more distribution emails could not be sent.",
          },
          { status: 201 },
        );
      }
    }

    return NextResponse.json(data, { status: 201 });
    },
);
