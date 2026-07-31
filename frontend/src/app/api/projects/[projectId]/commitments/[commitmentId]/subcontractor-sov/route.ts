import { withApiGuardrails } from "@/lib/guardrails/api";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

import { isAuthError, verifyProjectAccess } from "@/lib/supabase/auth-guard";
import { canEditSubcontractorSov } from "@/lib/commitments/subcontractor-sov-access";
import {
  ensureSubmission,
  getCommitmentType,
  getTargetAndSourceSov,
  getCommitmentContext,
  getActorRoleContext,
  getInvoiceContactEmails,
  sendSsovInviteEmail,
  notifyPMsOfSsovSubmission,
  notifySubcontractorOfSsovReview,
  createPmReviewTodos,
} from "@/lib/commitments/subcontractor-sov-service";

interface SsovLineItemInput {
  id?: string;
  source_sov_item_id: string | null;
  line_number: number | null;
  budget_code: string | null;
  description: string | null;
  amount: number | null;
  billed_to_date: number | null;
}

const STATUS_VALUES = ["draft", "under_review", "approved", "revise_resubmit"] as const;
type SsovStatus = (typeof STATUS_VALUES)[number];

interface SsovPermissions {
  canEdit: boolean;
  canReview: boolean;
  canSendNotification: boolean;
}

export const GET = withApiGuardrails(
  "projects/[projectId]/commitments/[commitmentId]/subcontractor-sov#GET",
  async ({ request, params }) => {

    const { projectId, commitmentId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const { serviceClient: supabase, membership } = authResult;

    const commitmentType = await getCommitmentType(supabase, commitmentId);
    if (commitmentType !== "subcontract") {
      return NextResponse.json(
        { error: "Subcontractor SOV is available for subcontracts only." },
        { status: 400 },
      );
    }

    const submission = await ensureSubmission(supabase, numericProjectId, commitmentId);
    const commitment = await getCommitmentContext(supabase, commitmentId);
    const actor = await getActorRoleContext(
      supabase,
      membership.authUserId,
      numericProjectId,
      membership.personId,
    );
    const permissions: SsovPermissions = {
      canEdit: canEditSubcontractorSov({
        actorPersonId: membership.personId,
        isUpstream: actor.isUpstream,
        commitment,
      }),
      canReview: actor.isUpstream,
      canSendNotification: actor.isUpstream,
    };
    const invoiceContacts = await getInvoiceContactEmails(
      supabase,
      commitment.invoice_contact_ids || [],
    );
    const { sourceSov, targetAmount } = await getTargetAndSourceSov(supabase, commitmentId);

    const { data: lineItems, error: lineItemsError } = await supabase
      .from("subcontractor_sov_items")
      .select("id, source_sov_item_id, line_number, budget_code, description, amount, billed_to_date")
      .eq("submission_id", submission.id)
      .order("line_number", { ascending: true });

    if (lineItemsError) throw lineItemsError;

    return NextResponse.json({
      data: {
        submissionId: submission.id,
        status: (submission.status as SsovStatus) || "draft",
        targetAmount,
        sourceSov,
        lineItems: lineItems || [],
        submittedAt: submission.submitted_at || null,
        reviewedAt: submission.reviewed_at || null,
        reviewNotes: submission.review_notes || null,
        inviteSentAt: submission.invite_sent_at || null,
        invoiceContacts,
        permissions,
      },
    });
    },
);

export const PUT = withApiGuardrails(
  "projects/[projectId]/commitments/[commitmentId]/subcontractor-sov#PUT",
  async ({ request, params }) => {

    const { projectId, commitmentId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const { serviceClient: supabase, membership } = authResult;

    const body = (await request.json()) as { lineItems: SsovLineItemInput[] };
    if (!Array.isArray(body.lineItems)) {
      return NextResponse.json(
        { error: "Invalid payload: lineItems array required." },
        { status: 400 },
      );
    }

    const submission = await ensureSubmission(supabase, numericProjectId, commitmentId);
    const commitment = await getCommitmentContext(supabase, commitmentId);
    const actor = await getActorRoleContext(
      supabase,
      membership.authUserId,
      numericProjectId,
      membership.personId,
    );

    if (!canEditSubcontractorSov({
      actorPersonId: membership.personId,
      isUpstream: actor.isUpstream,
      commitment,
    })) {
      return NextResponse.json(
        { error: "You are not allowed to edit this Subcontractor SOV." },
        { status: 403 },
      );
    }

    if (submission.status === "under_review" || submission.status === "approved") {
      return NextResponse.json(
        {
          error:
            "Subcontractor SOV cannot be edited while status is Under Review or Approved.",
        },
        { status: 400 },
      );
    }

    const { data: existingItems } = await supabase
      .from("subcontractor_sov_items")
      .select("id")
      .eq("submission_id", submission.id);

    const existingIds = new Set<string>((existingItems || []).map((row: { id: string }) => row.id));
    const incomingIds = new Set<string>(
      body.lineItems
        .map((row) => row.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );

    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("subcontractor_sov_items")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) throw deleteError;
    }

    for (let i = 0; i < body.lineItems.length; i++) {
      const item = body.lineItems[i];
      const rowData = {
        submission_id: submission.id,
        source_sov_item_id: item.source_sov_item_id || null,
        line_number: item.line_number ?? i + 1,
        budget_code: item.budget_code || null,
        description: item.description || null,
        amount: item.amount ?? 0,
        billed_to_date: item.billed_to_date ?? 0,
        updated_at: new Date().toISOString(),
      };

      if (item.id && existingIds.has(item.id)) {
        const { error } = await supabase
          .from("subcontractor_sov_items")
          .update(rowData)
          .eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subcontractor_sov_items").insert({
          ...rowData,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    }

    const { error: touchError } = await supabase
      .from("subcontractor_sov_submissions")
      .update({
        updated_at: new Date().toISOString(),
        status:
          submission.status === "approved"
            ? "revise_resubmit"
            : submission.status,
      })
      .eq("id", submission.id);
    if (touchError) throw touchError;

    return NextResponse.json({ success: true, message: "Subcontractor SOV saved." });
    },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/commitments/[commitmentId]/subcontractor-sov#POST",
  async ({ request, params }) => {

    const { projectId, commitmentId } = await params;
    const numericProjectId = Number.parseInt(projectId, 10);
    if (Number.isNaN(numericProjectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const authResult = await verifyProjectAccess(numericProjectId);
    if (isAuthError(authResult)) return authResult;
    const { serviceClient: supabase, membership } = authResult;

    const body = (await request.json()) as {
      action:
        | "submit"
        | "approve"
        | "reject"
        | "import_from_sov"
        | "send_notification";
      notes?: string;
    };
    if (!body?.action) {
      return NextResponse.json({ error: "Action is required." }, { status: 400 });
    }

    const submission = await ensureSubmission(supabase, numericProjectId, commitmentId);
    const commitment = await getCommitmentContext(supabase, commitmentId);
    const actor = await getActorRoleContext(
      supabase,
      membership.authUserId,
      numericProjectId,
      membership.personId,
    );
    const { sourceSov, targetAmount } = await getTargetAndSourceSov(supabase, commitmentId);

    const canEdit = canEditSubcontractorSov({
      actorPersonId: membership.personId,
      isUpstream: actor.isUpstream,
      commitment,
    });

    if (body.action === "import_from_sov") {
      if (!canEdit) {
        return NextResponse.json(
          { error: "You are not allowed to edit this Subcontractor SOV." },
          { status: 403 },
        );
      }
      if (submission.status === "under_review" || submission.status === "approved") {
        return NextResponse.json(
          { error: "Cannot import while status is Under Review or Approved." },
          { status: 400 },
        );
      }
      const { error: clearError } = await supabase
        .from("subcontractor_sov_items")
        .delete()
        .eq("submission_id", submission.id);
      if (clearError) throw clearError;

      if (sourceSov.length > 0) {
        const mapped = sourceSov.map((row, index) => ({
          submission_id: submission.id,
          source_sov_item_id: row.id,
          line_number: row.line_number ?? index + 1,
          budget_code: row.budget_code || null,
          description: row.description || null,
          amount: row.amount ?? 0,
          billed_to_date: row.billed_to_date ?? 0,
        }));
        const { error: insertError } = await supabase.from("subcontractor_sov_items").insert(mapped);
        if (insertError) throw insertError;
      }

      return NextResponse.json({
        success: true,
        message: "Imported SOV line items into subcontractor SOV.",
      });
    }

    if (body.action === "send_notification") {
      if (!actor.isUpstream) {
        return NextResponse.json(
          { error: "Only upstream project users can send SSOV notifications." },
          { status: 403 },
        );
      }
      const contacts = await getInvoiceContactEmails(
        supabase,
        commitment.invoice_contact_ids || [],
      );
      if (contacts.length === 0) {
        return NextResponse.json(
          {
            error:
              "No invoice contacts found. Add at least one invoice contact before sending SSOV notifications.",
          },
          { status: 400 },
        );
      }

      // Fetch project name + PM name + contract amount for the email template
      const [{ data: project }, { data: pmProfile }] = await Promise.all([
        supabase
          .from("projects")
          .select("name")
          .eq("id", numericProjectId)
          .maybeSingle(),
        supabase
          .from("people")
          .select("first_name, last_name")
          .eq("id", membership.personId)
          .maybeSingle(),
      ]);

      const sendResults = await sendSsovInviteEmail({
        supabase,
        recipients: contacts.map((contact: { id: string; name: string; email: string }) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
        })),
        projectId: numericProjectId,
        projectName: project?.name || `Project #${numericProjectId}`,
        commitmentId,
        commitmentNumber: commitment.contract_number,
        commitmentTitle: commitment.title,
        contractAmount: targetAmount,
        pmName:
          `${pmProfile?.first_name || ""} ${pmProfile?.last_name || ""}`.trim() ||
          "Your project manager",
        submissionId: submission.id,
      });

      const failedSends = sendResults.filter((result) => result.error);
      if (failedSends.length > 0) {
        const message = failedSends
          .map((result) => result.error?.message)
          .filter(Boolean)
          .join("; ");
        return NextResponse.json(
          {
            error:
              message ||
              "Subcontractor SOV invitation email failed to send.",
          },
          { status: 502 },
        );
      }

      const { error: inviteError } = await supabase
        .from("subcontractor_sov_submissions")
        .update({
          invite_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (inviteError) {
        throw inviteError;
      }

      return NextResponse.json({
        success: true,
        message: `Subcontractor SOV invitation sent to ${contacts.length} invoice contact${contacts.length !== 1 ? "s" : ""}.`,
      });
    }

    if (body.action === "submit") {
      if (!canEdit) {
        return NextResponse.json(
          { error: "You are not allowed to submit this Subcontractor SOV." },
          { status: 403 },
        );
      }
      if (!(submission.status === "draft" || submission.status === "revise_resubmit")) {
        return NextResponse.json(
          { error: "Subcontractor SOV can only be submitted from Draft or Revise & Resubmit." },
          { status: 400 },
        );
      }
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("subcontractor_sov_items")
        .select("amount")
        .eq("submission_id", submission.id);
      if (lineItemsError) throw lineItemsError;

      const allocated = (lineItems || []).reduce(
        (sum: number, row: { amount: number | null }) => sum + Number(row.amount ?? 0),
        0,
      );
      const remaining = Math.max(targetAmount - allocated, 0);
      if (remaining > 0) {
        return NextResponse.json(
          { error: "Remaining to Allocate must be $0.00 before submitting." },
          { status: 400 },
        );
      }

      const { error: submitError } = await supabase
        .from("subcontractor_sov_submissions")
        .update({
          status: "under_review",
          submitted_by: membership.personId,
          submitted_at: new Date().toISOString(),
          reviewed_by: null,
          reviewed_at: null,
          review_notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (submitError) throw submitError;

      // Fire-and-forget: create PM todos + send PM email notifications
      createPmReviewTodos({
        supabase,
        projectId: numericProjectId,
        commitmentId,
        commitmentNumber: commitment.contract_number || null,
        commitmentTitle: commitment.title || null,
      }).catch((err) => {
        logger.error({ msg: "[ssov-submit] PM review todos failed", error: err instanceof Error ? err.message : String(err) });
      });

      notifyPMsOfSsovSubmission({
        supabase,
        projectId: numericProjectId,
        commitmentId,
        commitmentNumber: commitment.contract_number,
        commitmentTitle: commitment.title,
        contractAmount: targetAmount,
        submissionId: submission.id,
      }).catch((err) => {
        logger.error({ msg: "[ssov-submit] PM email notification failed", error: err instanceof Error ? err.message : String(err) });
      });

      return NextResponse.json({
        success: true,
        message: "Subcontractor SOV submitted for review.",
      });
    }

    if (body.action === "approve" || body.action === "reject") {
      if (!actor.isUpstream) {
        return NextResponse.json(
          { error: "Only upstream project users can review and approve SSOV." },
          { status: 403 },
        );
      }
      if (submission.status !== "under_review") {
        return NextResponse.json(
          { error: "SSOV must be Under Review before it can be approved or returned." },
          { status: 400 },
        );
      }
      const nextStatus: SsovStatus =
        body.action === "approve" ? "approved" : "revise_resubmit";
      const reviewNotes = body.notes?.trim() || null;
      const { error: reviewError } = await supabase
        .from("subcontractor_sov_submissions")
        .update({
          status: nextStatus,
          reviewed_by: membership.personId,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (reviewError) throw reviewError;

      // Fire-and-forget: notify the subcontractor of the decision so the
      // ball-in-court hand-off is never silent.
      notifySubcontractorOfSsovReview({
        supabase,
        projectId: numericProjectId,
        commitmentId,
        commitmentNumber: commitment.contract_number,
        contractAmount: targetAmount,
        invoiceContactIds: commitment.invoice_contact_ids || [],
        decision: nextStatus === "approved" ? "approved" : "revise_resubmit",
        reviewNotes,
        submissionId: submission.id,
      }).catch((err) => {
        logger.error({
          msg: "[ssov-review] subcontractor notification failed",
          error: err instanceof Error ? err.message : String(err),
        });
      });

      return NextResponse.json({
        success: true,
        message: body.action === "approve"
          ? "Subcontractor SOV approved."
          : "Subcontractor SOV returned for revision.",
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    },
);
