/**
 * RFI API Route (Single Resource)
 *
 * GET /api/projects/[projectId]/rfis/[rfiId] - Get single RFI
 * PATCH /api/projects/[projectId]/rfis/[rfiId] - Update RFI
 * DELETE /api/projects/[projectId]/rfis/[rfiId] - Delete RFI
 */

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { notifyRfiClosed, notifyRfiOpened, notifyRfiUpdated } from "@/lib/rfi/rfi-notify";
import { rfiEditSchema } from "@/lib/schemas/rfi-schema";
import { RFI_RECIPIENT_UUID_PATTERN as UUID_PATTERN } from "@/lib/rfi/rfi-recipients";
import { ZodError } from "zod";
import { logger } from "@/lib/logger";

type RouteParams = {
  params: Promise<{ projectId: string; rfiId: string }>;
};

/**
 * GET /api/projects/[projectId]/rfis/[rfiId]
 */
export const GET = withApiGuardrails(
  "projects/[projectId]/rfis/[rfiId]#GET",
  async ({ request, params }) => {

    const { rfiId } = await params;
    assertNonNilUuid(rfiId, "rfiId", "projects/[projectId]/rfis/[rfiId]#GET");
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/rfis/[rfiId]#GET",
        message: "Authentication required.",
      });
    }

    const { data, error } = await supabase
      .from("rfis")
      .select("*")
      .eq("id", rfiId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "RFI not found" }, { status: 404 });
      }
      logger.error({ msg: "RFI get error:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // If created_by is a UUID, resolve it to an email/name for display.
    if (data.created_by && UUID_PATTERN.test(data.created_by)) {
            const { data: profile } = await serviceDb.from("user_profiles")
        .select("full_name, email")
        .eq("id", data.created_by)
        .maybeSingle();
      if (profile) {
        data.created_by =
          profile.full_name?.trim() ||
          profile.email ||
          data.created_by;
      }
    }

    return NextResponse.json(data);
    },
);

/**
 * PATCH /api/projects/[projectId]/rfis/[rfiId]
 */
export const PATCH = withApiGuardrails(
  "projects/[projectId]/rfis/[rfiId]#PATCH",
  async ({ request, params }) => {

    const { rfiId } = await params;
    assertNonNilUuid(rfiId, "rfiId", "projects/[projectId]/rfis/[rfiId]#PATCH");

    // Auth check — run BEFORE parsing the request body. An unauthenticated request
    // may have no body, so calling request.json() first would throw and surface a 500
    // instead of the correct 401.
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/rfis/[rfiId]#PATCH", message: "Authentication required." });
    }

    const { projectId } = await params;
    const numericProjectId = Number(projectId);

    const supabase = await createClient();
    const body = await request.json();

    // Validate update data
    const result = rfiEditSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation error", issues: result.error.flatten() },
        { status: 400 },
      );
    }

    // Build update object from validated fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const validatedData = result.data;
    if (validatedData.number !== undefined) {
      const { data: existingRfi, error: numberLookupError } = await supabase
        .from("rfis")
        .select("id")
        .eq("project_id", numericProjectId)
        .eq("number", validatedData.number)
        .neq("id", rfiId)
        .maybeSingle();

      if (numberLookupError) {
        logger.error({
          msg: "RFI number availability check failed",
          projectId: numericProjectId,
          rfiId,
          rfiNumber: validatedData.number,
          error: numberLookupError instanceof Error ? numberLookupError.message : String(numberLookupError),
        });
        return apiErrorResponse(numberLookupError);
      }

      if (existingRfi) {
        return NextResponse.json(
          {
            error: `RFI number ${validatedData.number} is already in use for this project. Choose another number.`,
            code: "RFI_NUMBER_CONFLICT",
          },
          { status: 409 },
        );
      }

      updateData.number = validatedData.number;
    }
    if (validatedData.subject !== undefined)
      updateData.subject = validatedData.subject;
    if (validatedData.question !== undefined)
      updateData.question = validatedData.question;
    if (validatedData.due_date !== undefined)
      updateData.due_date = validatedData.due_date;
    if (validatedData.assignees !== undefined)
      updateData.assignees = validatedData.assignees;
    if (validatedData.rfi_manager !== undefined)
      updateData.rfi_manager = validatedData.rfi_manager;
    if (validatedData.received_from !== undefined)
      updateData.received_from = validatedData.received_from;
    if (validatedData.responsible_contractor !== undefined)
      updateData.responsible_contractor = validatedData.responsible_contractor;
    if (validatedData.distribution_list !== undefined)
      updateData.distribution_list = validatedData.distribution_list;
    if (validatedData.location !== undefined)
      updateData.location = validatedData.location;
    if (validatedData.specification !== undefined)
      updateData.specification = validatedData.specification;
    if (validatedData.cost_code !== undefined)
      updateData.cost_code = validatedData.cost_code;
    if (validatedData.schedule_impact !== undefined)
      updateData.schedule_impact = validatedData.schedule_impact;
    if (validatedData.cost_impact !== undefined)
      updateData.cost_impact = validatedData.cost_impact;
    if (validatedData.reference !== undefined)
      updateData.reference = validatedData.reference;
    if (validatedData.is_private !== undefined)
      updateData.is_private = validatedData.is_private;
    if (validatedData.rfi_stage !== undefined)
      updateData.rfi_stage = validatedData.rfi_stage;
    if (validatedData.drawing_number !== undefined)
      updateData.drawing_number = validatedData.drawing_number;

    // When assignees change, sync ball_in_court (unless a status change will handle it)
    if (validatedData.assignees !== undefined && body.status === undefined) {
      const { data: currentRfi } = await supabase
      .from("rfis")
      .select("status")
      .eq("id", rfiId)
      .eq("project_id", numericProjectId)
      .single();
      const isOpen = !["closed", "closed-draft"].includes(currentRfi?.status ?? "");
      if (isOpen) {
        updateData.ball_in_court =
          validatedData.assignees.length > 0
            ? validatedData.assignees.join(", ")
            : null;
      }
    }

    // Set when a draft RFI is distributed (draft → open) so we notify recipients.
    let openedFromDraft = false;

    // Handle status changes from body (not in base schema)
    if (body.status !== undefined) {
      let newStatus = body.status as string;

      // Fetch current RFI status for transition logic
      const { data: currentRfi } = await supabase
      .from("rfis")
      .select("status, assignees")
      .eq("id", rfiId)
      .eq("project_id", numericProjectId)
      .single();

      const currentStatus = currentRfi?.status ?? "";

      // Close from Draft → closed-draft
      if (newStatus === "closed" && currentStatus === "draft") {
        newStatus = "closed-draft";
      }

      // Reopen logic
      if (newStatus === "open" && currentStatus === "draft") {
        // Distribute a draft RFI → set ball-in-court and notify recipients
        openedFromDraft = true;
        updateData.ball_in_court =
          currentRfi?.assignees?.join(", ") ?? null;
      } else if (newStatus === "open" && currentStatus === "closed") {
        // Reopen from closed → open
        updateData.closed_date = null;
        updateData.ball_in_court =
          currentRfi?.assignees?.join(", ") ?? null;
      } else if (newStatus === "draft" && currentStatus === "closed-draft") {
        // Reopen from closed-draft → draft
        updateData.closed_date = null;
      } else if (newStatus === "closed" || newStatus === "closed-draft") {
        // Closing — set closed_date and clear ball_in_court
        updateData.closed_date = new Date().toISOString().split("T")[0];
        updateData.ball_in_court = null;
      }

      updateData.status = newStatus;
    }

    // Snapshot the pre-update state so we can describe what changed for the
    // RFI-updated notification (submitter + reviewers).
    const { data: beforeRfi } = await supabase
      .from("rfis")
      .select("status, assignees, due_date, question")
      .eq("id", rfiId)
      .eq("project_id", numericProjectId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("rfis")
      .update(updateData)
      .eq("id", rfiId)
      .eq("project_id", numericProjectId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && validatedData.number !== undefined) {
        return NextResponse.json(
          {
            error: `RFI number ${validatedData.number} is already in use for this project. Choose another number.`,
            code: "RFI_NUMBER_CONFLICT",
          },
          { status: 409 },
        );
      }
      logger.error({ msg: "RFI update error:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    // Closing an RFI is a user-visible notification action. The status change
    // has already been persisted above — a notification-email failure must NOT
    // fail the whole request (that would show the user a failure toast for an
    // operation that actually succeeded). Instead, attempt the email separately
    // and surface a non-blocking warning if it fails.
    const newStatus = updateData.status as string | undefined;
    if (newStatus === "closed" || newStatus === "closed-draft") {
      const { projectId } = await params;
      const notificationResult = await notifyRfiClosed({
        projectId: parseInt(projectId, 10),
        rfiId,
        closedByUserId: user.id,
      });

      if (notificationResult.failed.length > 0) {
        logger.warn({
          msg: "RFI closed but close-notification email(s) failed",
          rfiId,
          failed: notificationResult.failed,
        });
        return NextResponse.json({
          ...data,
          _emailWarning:
            "RFI closed, but one or more close-notification emails could not be sent.",
        });
      }
    }

    // Distributing a draft RFI (draft → open) notifies its recipients. Same
    // non-blocking contract as close: the state is already saved, so an email
    // failure surfaces as a warning rather than failing the request.
    if (openedFromDraft) {
      const { projectId } = await params;
      const notificationResult = await notifyRfiOpened({
        projectId: parseInt(projectId, 10),
        rfiId,
        actorUserId: user.id,
      });

      if (notificationResult.failed.length > 0) {
        logger.warn({
          msg: "RFI opened but distribution email(s) failed",
          rfiId,
          failed: notificationResult.failed,
        });
        return NextResponse.json({
          ...data,
          _emailWarning:
            "RFI opened, but one or more distribution emails could not be sent.",
        });
      }
    }

    // Updating a live RFI (status change, reassignment, due-date or question
    // edit) notifies everyone involved — submitter + reviewers. The open/close
    // transitions above own their own emails, so they're excluded here. Drafts
    // are not yet distributed, so they're silent.
    const STATUS_LABELS: Record<string, string> = {
      open: "Open",
      answered: "Answered",
      closed: "Closed",
      "closed-draft": "Closed",
      draft: "Draft",
    };
    const finalStatus = (updateData.status as string | undefined) ?? beforeRfi?.status ?? "";
    const isClosingTransition = newStatus === "closed" || newStatus === "closed-draft";
    const isLiveRfi = finalStatus === "open" || finalStatus === "answered";

    if (!openedFromDraft && !isClosingTransition && isLiveRfi) {
      const changeSummary: string[] = [];

      if (
        updateData.status !== undefined &&
        updateData.status !== beforeRfi?.status
      ) {
        changeSummary.push(
          `Status changed to ${STATUS_LABELS[updateData.status as string] ?? updateData.status}`,
        );
      }
      if (
        validatedData.assignees !== undefined &&
        (validatedData.assignees ?? []).join("|") !==
          (beforeRfi?.assignees ?? []).join("|")
      ) {
        const list = (validatedData.assignees ?? []).join(", ");
        changeSummary.push(list ? `Reassigned to ${list}` : "Assignees cleared");
      }
      if (
        validatedData.due_date !== undefined &&
        (validatedData.due_date ?? null) !== (beforeRfi?.due_date ?? null)
      ) {
        changeSummary.push(
          validatedData.due_date
            ? `Due date set to ${validatedData.due_date}`
            : "Due date cleared",
        );
      }
      if (
        validatedData.question !== undefined &&
        (validatedData.question ?? "") !== (beforeRfi?.question ?? "")
      ) {
        changeSummary.push("Question updated");
      }
      if (validatedData.number !== undefined) {
        changeSummary.push(`RFI number changed to #${validatedData.number}`);
      }

      if (changeSummary.length > 0) {
        const { projectId } = await params;
        const notificationResult = await notifyRfiUpdated({
          projectId: parseInt(projectId, 10),
          rfiId,
          actorUserId: user.id,
          changeSummary,
        });

        if (notificationResult.failed.length > 0) {
          logger.warn({
            msg: "RFI updated but update-notification email(s) failed",
            rfiId,
            failed: notificationResult.failed,
          });
          return NextResponse.json({
            ...data,
            _emailWarning:
              "RFI updated, but one or more notification emails could not be sent.",
          });
        }
      }
    }

    return NextResponse.json(data);
    },
);

/**
 * DELETE /api/projects/[projectId]/rfis/[rfiId]
 */
export const DELETE = withApiGuardrails(
  "projects/[projectId]/rfis/[rfiId]#DELETE",
  async ({ request, params }) => {

    const { rfiId } = await params;
    assertNonNilUuid(rfiId, "rfiId", "projects/[projectId]/rfis/[rfiId]#DELETE");
    const supabase = await createClient();

    // Auth check
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "projects/[projectId]/rfis/[rfiId]#DELETE", message: "Authentication required." });
    }

    const { error } = await supabase.from("rfis").delete().eq("id", rfiId);

    if (error) {
      logger.error({ msg: "RFI delete error:", error: error instanceof Error ? error.message : String(error) });
      return apiErrorResponse(error);
    }

    return NextResponse.json({ message: "RFI deleted successfully", id: rfiId });
    },
);
