/**
 * Subcontractor SOV business logic.
 *
 * Pure domain functions extracted from the API route. Every function accepts
 * an explicit Supabase service client so it can be tested independently of
 * the HTTP layer.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { APP_BASE_URL } from "@/lib/email/client";
import { logger } from "@/lib/logger";
import { notifyStatusChange } from "@/services/notificationService";
import {
  mergeSubcontractorSovAccessIds,
  type SubcontractorSovCommitmentAccess,
} from "@/lib/commitments/subcontractor-sov-access";
import type { Database } from "@/types/database.types";

export type ServiceClient = ReturnType<typeof createServiceClient>;

type SubcontractorSovSubmissionRow =
  Database["public"]["Tables"]["subcontractor_sov_submissions"]["Row"];

export type SourceSovLine = Pick<
  Database["public"]["Tables"]["subcontract_sov_items"]["Row"],
  "id" | "line_number" | "budget_code" | "description" | "amount" | "billed_to_date"
>;

type ProjectMemberForReview = Pick<
  Database["public"]["Tables"]["project_directory_memberships"]["Row"],
  "person_id" | "role"
>;

type AuthLinkForTodo = Pick<
  Database["public"]["Tables"]["users_auth"]["Row"],
  "person_id" | "auth_user_id"
>;

type PersonEmailRow = Pick<
  Database["public"]["Tables"]["people"]["Row"],
  "id" | "first_name" | "last_name" | "email"
>;

export interface CommitmentContext extends SubcontractorSovCommitmentAccess {
  contract_number: string | null;
  title: string | null;
  status: string | null;
}

// ---------------------------------------------------------------------------
// Submission bootstrap
// ---------------------------------------------------------------------------

export async function ensureSubmission(
  supabase: ServiceClient,
  projectId: number,
  commitmentId: string,
): Promise<SubcontractorSovSubmissionRow> {
  const existing = await supabase
    .from("subcontractor_sov_submissions")
    .select("*")
    .eq("project_id", projectId)
    .eq("commitment_id", commitmentId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from("subcontractor_sov_submissions")
    .insert({
      project_id: projectId,
      commitment_id: commitmentId,
      status: "draft",
    })
    .select("*")
    .single();

  if (created.error) throw created.error;
  return created.data;
}

// ---------------------------------------------------------------------------
// Context loaders
// ---------------------------------------------------------------------------

export async function getCommitmentType(supabase: ServiceClient, commitmentId: string) {
  const { data, error } = await supabase
    .from("commitments_unified")
    .select("commitment_type")
    .eq("id", commitmentId)
    .single();

  if (error || !data) return null;
  return data.commitment_type as string | null;
}

export async function getTargetAndSourceSov(supabase: ServiceClient, commitmentId: string) {
  const { data: sourceSov, error } = await supabase
    .from("subcontract_sov_items")
    .select("id, line_number, budget_code, description, amount, billed_to_date")
    .eq("subcontract_id", commitmentId)
    .order("line_number", { ascending: true });

  if (error) throw error;

  const rows = (sourceSov || []) as SourceSovLine[];
  const targetAmount = rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return { sourceSov: rows, targetAmount };
}

export async function getCommitmentContext(
  supabase: ServiceClient,
  commitmentId: string,
): Promise<CommitmentContext> {
  const { data, error } = await supabase
    .from("subcontracts")
    .select(
      "contract_number, title, status, is_private, invoice_contact_ids, non_admin_user_ids, allow_non_admin_view_sov_items",
    )
    .eq("id", commitmentId)
    .single();

  if (error || !data) {
    throw error || new Error("Commitment not found.");
  }

  return data as CommitmentContext;
}

export async function getActorRoleContext(
  supabase: ServiceClient,
  authUserId: string,
  projectId: number,
  personId: string,
) {
  const [
    { data: profile, error: profileError },
    { data: membership, error: membershipError },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("id", authUserId)
      .maybeSingle(),
    supabase
      .from("project_directory_memberships")
      .select("role, user_type")
      .eq("project_id", projectId)
      .eq("person_id", personId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (profileError) throw profileError;
  if (membershipError) throw membershipError;

  const role = (membership?.role || "").toLowerCase();
  const userType = (membership?.user_type || "").toLowerCase();
  const isAdmin = profile?.is_admin === true;
  const isPm = role.includes("project manager") || role === "pm";
  const isUpstream = isAdmin || isPm || userType === "employee" || userType === "admin";

  return { isAdmin, isPm, isUpstream };
}

export async function getInvoiceContactEmails(supabase: ServiceClient, invoiceContactIds: string[]) {
  if (invoiceContactIds.length === 0) return [];
  const { data, error } = await supabase
    .from("people")
    .select("id, first_name, last_name, email")
    .in("id", invoiceContactIds);

  if (error) throw error;

  return (data || [])
    .filter((person): person is PersonEmailRow & { email: string } => !!person.email)
    .map((person) => ({
      id: person.id,
      name: `${person.first_name || ""} ${person.last_name || ""}`.trim() || "Invoice Contact",
      email: person.email,
    }));
}

// ---------------------------------------------------------------------------
// Access management
// ---------------------------------------------------------------------------

async function grantSsovAccessToInvoiceContacts(args: {
  supabase: ServiceClient;
  commitmentId: string;
  recipientPersonIds: string[];
}) {
  const { supabase, commitmentId, recipientPersonIds } = args;
  if (recipientPersonIds.length === 0) return;

  const { data: commitment, error } = await supabase
    .from("subcontracts")
    .select("non_admin_user_ids")
    .eq("id", commitmentId)
    .single();

  if (error || !commitment) {
    throw error || new Error("Unable to grant SSOV access because the commitment was not found.");
  }

  const mergedPersonIds = mergeSubcontractorSovAccessIds(
    commitment.non_admin_user_ids || [],
    recipientPersonIds,
  );

  const { error: updateError } = await supabase
    .from("subcontracts")
    .update({
      non_admin_user_ids: mergedPersonIds,
      allow_non_admin_view_sov_items: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commitmentId);

  if (updateError) throw updateError;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function sendSsovInviteEmail(args: {
  supabase: ServiceClient;
  recipients: Array<{ id: string; name: string; email: string }>;
  projectId: number;
  projectName: string;
  commitmentId: string;
  commitmentNumber: string | null;
  commitmentTitle: string | null;
  contractAmount: number;
  pmName: string;
  submissionId: string;
}) {
  const {
    supabase,
    recipients,
    projectId,
    projectName,
    commitmentId,
    commitmentNumber,
    commitmentTitle,
    contractAmount,
    pmName,
    submissionId,
  } = args;
  if (recipients.length === 0) return [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const subject = `Submit your Schedule of Values${commitmentNumber ? ` — ${commitmentNumber}` : ""}`;
  const sovTabPath = `/${projectId}/commitments/${commitmentId}?tab=subcontractor-sov`;
  const submissionUrl = `${appUrl}${sovTabPath}`;
  const contractAmountFormatted = contractAmount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  // 14 days from now
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Fetch the Subcontractor system permission template ID once for the whole batch.
  const { data: subcontractorTemplate } = await supabase
    .from("permission_templates")
    .select("id")
    .eq("name", "Subcontractor")
    .eq("is_system", true)
    .maybeSingle();
  const subcontractorTemplateId = subcontractorTemplate?.id ?? null;

  await grantSsovAccessToInvoiceContacts({
    supabase,
    commitmentId,
    recipientPersonIds: recipients.map((recipient) => recipient.id),
  });

  // Check which recipients already have auth accounts
  const { data: existingAuthLinks } = await supabase
    .from("users_auth")
    .select("person_id")
    .in("person_id", recipients.map((r) => r.id));

  const existingPersonIds = new Set((existingAuthLinks || []).map((row: { person_id: string }) => row.person_id));

  // Resolve email templates once before the fan-out to avoid redundant awaits per recipient.
  const [{ default: SOVInvitation }, { default: SubcontractorSovInvite }] = await Promise.all([
    import("@/emails/subcontractor/SOVInvitation"),
    import("@/emails/subcontractor/SubcontractorSovInvite"),
  ]);

  // Send individually so each recipient gets personalized greeting + own idempotency key
  return Promise.all(
    recipients.map(async (recipient) => {
      const isNewUser = !existingPersonIds.has(recipient.id);

      if (isNewUser) {
        // Generate a Supabase magic invite link for account creation.
        // After OTP verification, the user lands on /auth/update-password?next=<sovTabPath>
        // where they set their password and are then redirected to the SOV tab.
        const passwordSetupUrl = `/auth/update-password?email=${encodeURIComponent(recipient.email)}&next=${encodeURIComponent(sovTabPath)}`;
        const confirmBaseUrl = `${appUrl}/auth/confirm`;

        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: "invite",
          email: recipient.email,
          options: {
            // redirectTo is where Supabase sends the browser after OTP verification.
            // We point it at our /auth/confirm route which handles the token_hash.
            // However, generateLink returns an action_link we can rewrite for SSR.
            redirectTo: `${appUrl}/auth/callback`,
          },
        });

        if (linkError || !linkData?.properties?.action_link) {
          logger.error({ msg: `[ssov-invite] Failed to generate invite link for ${recipient.email}`, error: linkError instanceof Error ? linkError.message : String(linkError) });
          // Fall back to sending a regular notification with the direct (auth-required) link
          return sendEmail({
            template: "sov-invitation",
            to: recipient.email,
            subject,
            react: SOVInvitation({
              subcontractorName: recipient.name,
              projectName,
              commitmentNumber: commitmentNumber || "—",
              contractAmount: contractAmountFormatted,
              dueDate,
              submissionUrl,
              pmName,
            }),
            entity: { type: "sov_submission", id: submissionId },
            idempotencyKey: `sov-invite/${submissionId}/${recipient.email}`,
            metadata: { projectId, commitmentId, commitmentTitle },
          });
        }

        // Extract the OTP token from the action_link and build a SSR-friendly confirm URL.
        // The action_link looks like: https://PROJECT.supabase.co/auth/v1/verify?token=TOKEN&type=invite&...
        const actionUrl = new URL(linkData.properties.action_link);
        const token = actionUrl.searchParams.get("token");

        let inviteUrl: string;
        if (token) {
          // Build our own SSR-safe confirm URL so the session is set via cookies
          inviteUrl = `${confirmBaseUrl}?token_hash=${token}&type=invite&next=${encodeURIComponent(passwordSetupUrl)}`;
        } else {
          // Fallback: use the raw action_link (less ideal for SSR)
          inviteUrl = linkData.properties.action_link;
        }

        // Ensure the person has a subcontractor membership for this project so they
        // can access it after logging in.
        await supabase
          .from("project_directory_memberships")
          .upsert(
            {
              person_id: recipient.id,
              project_id: projectId,
              user_type: "subcontractor",
              status: "active",
              ...(subcontractorTemplateId ? { permission_template_id: subcontractorTemplateId } : {}),
            },
            { onConflict: "person_id,project_id", ignoreDuplicates: false },
          );

        return sendEmail({
          template: "sov-invite-new-user",
          to: recipient.email,
          subject: `You're invited: ${subject}`,
          react: SubcontractorSovInvite({
            subcontractorName: recipient.name,
            projectName,
            commitmentNumber: commitmentNumber || "—",
            contractAmount: contractAmountFormatted,
            dueDate,
            inviteUrl,
            pmName,
          }),
          entity: { type: "sov_submission", id: submissionId },
          idempotencyKey: `sov-invite-new/${submissionId}/${recipient.email}`,
          metadata: { projectId, commitmentId, commitmentTitle },
        });
      }

      // Ensure existing users also have the subcontractor membership + template assigned.
      await supabase
        .from("project_directory_memberships")
        .upsert(
          {
            person_id: recipient.id,
            project_id: projectId,
            user_type: "subcontractor",
            status: "active",
            ...(subcontractorTemplateId ? { permission_template_id: subcontractorTemplateId } : {}),
          },
          { onConflict: "person_id,project_id", ignoreDuplicates: false },
        );

      // Existing user — send standard notification with direct link
      return sendEmail({
        template: "sov-invitation",
        to: recipient.email,
        subject,
        react: SOVInvitation({
          subcontractorName: recipient.name,
          projectName,
          commitmentNumber: commitmentNumber || "—",
          contractAmount: contractAmountFormatted,
          dueDate,
          submissionUrl,
          pmName,
        }),
        entity: { type: "sov_submission", id: submissionId },
        idempotencyKey: `sov-invite/${submissionId}/${recipient.email}`,
        metadata: { projectId, commitmentId, commitmentTitle },
      });
    }),
  );
}

export async function notifyPMsOfSsovSubmission(args: {
  supabase: ServiceClient;
  projectId: number;
  commitmentId: string;
  commitmentNumber: string | null;
  commitmentTitle: string | null;
  contractAmount: number;
  submissionId: string;
}) {
  const {
    supabase,
    projectId,
    commitmentId,
    commitmentNumber,
    commitmentTitle,
    contractAmount,
    submissionId,
  } = args;

  // Find PMs on the project
  const { data: pmMembers } = await supabase
    .from("project_directory_memberships")
    .select("person_id, role")
    .eq("project_id", projectId)
    .eq("status", "active");

  const projectMembers = (pmMembers || []) as ProjectMemberForReview[];
  const pmPersonIds = projectMembers
    .filter((m) => {
      const r = (m.role || "").toLowerCase();
      return r.includes("project manager") || r === "pm";
    })
    .map((m) => m.person_id);

  if (pmPersonIds.length === 0) return;

  const [{ data: people }, { data: project }, { data: subcontract }] =
    await Promise.all([
      supabase
        .from("people")
        .select("id, first_name, last_name, email")
        .in("id", pmPersonIds),
      supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("subcontracts")
        .select("contract_company_id")
        .eq("id", commitmentId)
        .maybeSingle(),
    ]);

  const recipients: Array<{ name: string; email: string }> = ((people || []) as PersonEmailRow[])
    .filter((p): p is PersonEmailRow & { email: string } => !!p.email)
    .map((p) => ({
      name:
        `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
        "Project manager",
      email: p.email,
    }));

  if (recipients.length === 0) return;

  // Resolve subcontractor display name
  let subcontractorName = commitmentTitle || "A subcontractor";
  if (subcontract?.contract_company_id) {
    const { data: vendor } = await supabase
      .from("companies")
      .select("name")
      .eq("id", subcontract.contract_company_id)
      .maybeSingle();
    if (vendor?.name) subcontractorName = vendor.name;
  }

  const projectName = project?.name || `Project #${projectId}`;
  const reviewUrl = `${APP_BASE_URL}/${projectId}/commitments/${commitmentId}?tab=subcontractor-sov`;
  const contractAmountFormatted = contractAmount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
  const subject = `Subcontractor SOV submitted${commitmentNumber ? ` — ${commitmentNumber}` : ""} — review needed`;

  const { default: SSOVSubmittedToPM } = await import("@/emails/subcontractor/SSOVSubmittedToPM");
  await Promise.all(
    recipients.map((r) =>
      sendEmail({
        template: "sov-submitted-to-pm",
        to: r.email,
        subject,
        react: SSOVSubmittedToPM({
          pmName: r.name,
          subcontractorName,
          projectName,
          commitmentNumber: commitmentNumber || "—",
          commitmentTitle: commitmentTitle || "—",
          contractAmount: contractAmountFormatted,
          reviewUrl,
        }),
        entity: { type: "sov_submission", id: submissionId },
        idempotencyKey: `sov-submitted/${submissionId}/${r.email}`,
      }),
    ),
  );
}

/**
 * Notify the subcontractor (invoice contacts) when their SOV is approved or
 * returned for revision. Closes the previously-silent ball-in-court hand-off:
 * before this, the subcontractor only learned the outcome by logging back in.
 * Sends email + best-effort in-app/Teams notification.
 */
export async function notifySubcontractorOfSsovReview(args: {
  supabase: ServiceClient;
  projectId: number;
  commitmentId: string;
  commitmentNumber: string | null;
  contractAmount: number;
  invoiceContactIds: string[];
  decision: "approved" | "revise_resubmit";
  reviewNotes?: string | null;
  submissionId: string;
}) {
  const {
    supabase,
    projectId,
    commitmentId,
    commitmentNumber,
    contractAmount,
    invoiceContactIds,
    decision,
    reviewNotes,
    submissionId,
  } = args;

  const contacts = await getInvoiceContactEmails(supabase, invoiceContactIds);
  if (contacts.length === 0) return;

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  const projectName = project?.name || `Project #${projectId}`;

  const contractAmountFormatted = contractAmount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

  const sovTabUrl = `${APP_BASE_URL}/${projectId}/commitments/${commitmentId}?tab=subcontractor-sov`;

  if (decision === "approved") {
    const { default: SovApprovedToSub } = await import("@/emails/subcontractor/SovApprovedToSub");
    await Promise.all(
      contacts.map((contact) =>
        sendEmail({
          template: "sov-approved",
          to: contact.email,
          subject: `Schedule of Values approved${commitmentNumber ? ` — ${commitmentNumber}` : ""}`,
          react: SovApprovedToSub({
            subcontractorName: contact.name,
            projectName,
            commitmentNumber: commitmentNumber || "—",
            contractAmount: contractAmountFormatted,
            invoiceUrl: sovTabUrl,
          }),
          entity: { type: "sov_submission", id: submissionId },
          idempotencyKey: `sov-approved/${submissionId}/${contact.email}`,
        }),
      ),
    );
  } else {
    const { default: SovRejectedToSub } = await import("@/emails/subcontractor/SovRejectedToSub");
    await Promise.all(
      contacts.map((contact) =>
        sendEmail({
          template: "sov-rejected",
          to: contact.email,
          subject: `Schedule of Values needs revisions${commitmentNumber ? ` — ${commitmentNumber}` : ""}`,
          react: SovRejectedToSub({
            subcontractorName: contact.name,
            projectName,
            commitmentNumber: commitmentNumber || "—",
            reviewNotes: reviewNotes ?? null,
            resubmitUrl: sovTabUrl,
          }),
          entity: { type: "sov_submission", id: submissionId },
          idempotencyKey: `sov-rejected/${submissionId}/${contact.email}`,
        }),
      ),
    );
  }

  // Best-effort in-app + Teams notification (never blocks the email path).
  try {
    const { data: authLinks } = await supabase
      .from("users_auth")
      .select("auth_user_id")
      .in("person_id", contacts.map((contact) => contact.id));
    const authUserIds = ((authLinks || []) as Array<{ auth_user_id: string | null }>)
      .map((row) => row.auth_user_id)
      .filter((id): id is string => !!id);
    if (authUserIds.length > 0) {
      await notifyStatusChange(authUserIds, {
        projectId,
        entityType: "sov_submission",
        entityId: submissionId,
        from: "under_review",
        to: decision,
      });
    }
  } catch (err) {
    logger.error({
      msg: "[ssov-review] in-app notification failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function createPmReviewTodos(params: {
  supabase: ServiceClient;
  projectId: number;
  commitmentId: string;
  commitmentNumber?: string | null;
  commitmentTitle?: string | null;
}) {
  const { supabase, projectId, commitmentId, commitmentNumber, commitmentTitle } = params;

  const { data: pmMembers } = await supabase
    .from("project_directory_memberships")
    .select("person_id, role")
    .eq("project_id", projectId)
    .eq("status", "active");

  const projectMembers = (pmMembers || []) as ProjectMemberForReview[];
  const pms = projectMembers.filter((m) =>
    (m.role || "").toLowerCase().includes("project manager") ||
    (m.role || "").toLowerCase() === "pm",
  );

  if (pms.length === 0) return;

  const personIds = pms.map((member) => member.person_id);
  const { data: authLinks } = await supabase
    .from("users_auth")
    .select("person_id, auth_user_id")
    .in("person_id", personIds);

  const tasks = ((authLinks || []) as AuthLinkForTodo[])
    .filter((row) => !!row.auth_user_id)
    .map((row) => ({
      user_id: row.auth_user_id,
      task: `Review subcontractor SOV for commitment ${commitmentNumber || commitmentTitle || commitmentId} in project ${projectId}: /${projectId}/commitments/${commitmentId}?tab=subcontractor-sov`,
      is_complete: false,
    }));

  if (tasks.length > 0) {
    const userIds = tasks.map((task: { user_id: string }) => task.user_id);
    const { data: existingTodos } = await supabase
      .from("todos")
      .select("user_id, task, is_complete")
      .in("user_id", userIds)
      .eq("is_complete", false);

    const existingLookup = new Set(
      (existingTodos || []).map(
        (todo: { user_id: string; task: string | null }) =>
          `${todo.user_id}:${todo.task || ""}`,
      ),
    );

    const tasksToInsert = tasks.filter(
      (task: { user_id: string; task: string }) =>
        !existingLookup.has(`${task.user_id}:${task.task}`),
    );

    if (tasksToInsert.length > 0) {
      await supabase.from("todos").insert(tasksToInsert);
    }
  }
}
