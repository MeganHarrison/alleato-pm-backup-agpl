/**
 * RFI notification senders (server-only).
 *
 * Two user-visible RFI emails share the same recipient-resolution logic:
 *  - `notifyRfiOpened`  — RFI distributed (created as open, or draft → open)
 *  - `notifyRfiClosed`  — RFI closed, official response available
 *
 * Both resolve the RFI's person columns (assignees / distribution_list /
 * rfi_manager / created_by) to real `people` emails via
 * `resolveRfiRecipientEmails`. Those columns store DISPLAY NAMES (and
 * historically UUIDs or raw emails), so all three shapes are handled — see
 * `rfi-recipients.ts`.
 *
 * Sending is best-effort: the caller has already persisted the RFI state, so a
 * notification failure must surface as a non-blocking warning, never fail the
 * request.
 */

import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { APP_BASE_URL } from "@/lib/email/client";
import RFIClosedNotification from "@/emails/rfi/RFIClosedNotification";
import RFINotification from "@/emails/rfi/RFINotification";
import RFIUpdateNotification from "@/emails/rfi/RFIUpdateNotification";
import { classifyRfiRecipientEntries, personFullNameKey } from "./rfi-recipients";
import { createRfiResponseToken } from "./response-tokens";
import { parseReplyMailbox, buildRfiReplyAddress } from "./email-reply";
import RFIResponseReceivedNotification from "@/emails/rfi/RFIResponseReceivedNotification";
import {
  recordRfiOpenedAiNotificationDecisions,
  type RfiAiNotificationDecisionSummary,
  type RfiAiNotificationRecipient,
} from "./rfi-ai-notifications";

type ServiceClient = ReturnType<typeof createServiceClient>;

export interface RfiNotifyResult {
  sent: number;
  failed: Array<{ email?: string; error: string }>;
  aiDecisions?: RfiAiNotificationDecisionSummary;
}

type RfiRecipient = RfiAiNotificationRecipient;

type PersonEmailCandidate = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  auth_user_id?: string | null;
};

/**
 * Resolve raw RFI recipient entries (display names / UUIDs / emails) to a
 * deduped list of `{ name, email }`. Returns `error` only on a query failure;
 * an empty selection or zero email-bearing matches returns `recipients: []`.
 */
async function resolveRfiRecipientEmails(
  supabase: ServiceClient,
  entries: Array<string | null | undefined>,
): Promise<{ recipients: RfiRecipient[]; error?: string }> {
  const { personIds, emails, names } = classifyRfiRecipientEntries(entries);

  if (personIds.size === 0 && emails.size === 0 && names.size === 0) {
    return { recipients: [] };
  }

  const [
    { data: peopleById, error: peopleByIdError },
    { data: peopleByEmail, error: peopleByEmailError },
    { data: peopleByName, error: peopleByNameError },
  ] = await Promise.all([
    personIds.size > 0
      ? supabase
          .from("people")
          .select("id, first_name, last_name, email, auth_user_id")
          .in("id", [...personIds])
      : Promise.resolve({ data: [], error: null }),
    emails.size > 0
      ? supabase
          .from("people")
          .select("id, first_name, last_name, email, auth_user_id")
          .in("email", [...emails])
      : Promise.resolve({ data: [], error: null }),
    // Name-shaped entries: no FK to join on, so match the computed full name in
    // memory. Only queried when there are names to resolve.
    names.size > 0
      ? supabase.from("people").select("id, first_name, last_name, email, auth_user_id")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (peopleByIdError || peopleByEmailError || peopleByNameError) {
    return {
      recipients: [],
      error:
        peopleByIdError?.message ??
        peopleByEmailError?.message ??
        peopleByNameError?.message ??
        "Failed to resolve RFI notification recipients.",
    };
  }

  const nameMatchedPeople = (peopleByName || []).filter((p) =>
    names.has(personFullNameKey(p.first_name, p.last_name)),
  );

  const recipientByEmail = new Map<string, RfiRecipient>();
  const authUserIdsByEmail = new Map<string, Set<string>>();
  for (const p of [
    ...(peopleById || []),
    ...(peopleByEmail || []),
    ...nameMatchedPeople,
  ] satisfies PersonEmailCandidate[]) {
    if (!p.email) continue;
    const email = p.email;
    recipientByEmail.set(p.email, {
      name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Team member",
      email,
      userMappingStatus: "unmapped",
    });

    if (p.auth_user_id) {
      const authUserIds = authUserIdsByEmail.get(email) ?? new Set<string>();
      authUserIds.add(p.auth_user_id);
      authUserIdsByEmail.set(email, authUserIds);
    }
  }

  for (const [email, recipient] of recipientByEmail.entries()) {
    const authUserIds = authUserIdsByEmail.get(email) ?? new Set<string>();
    if (authUserIds.size === 1) {
      recipient.userId = [...authUserIds][0];
      recipient.userMappingStatus = "mapped";
    } else if (authUserIds.size > 1) {
      recipient.userMappingStatus = "ambiguous";
    }
  }

  return { recipients: [...recipientByEmail.values()] };
}

/** Resolve a user id to a human display name for "sent by" / "closed by". */
async function resolveActorName(
  supabase: ServiceClient,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name?.trim() || data?.email?.split("@")[0] || "A team member";
}

// ── RFI distributed (opened) notification ───────────────────────────────────

export async function notifyRfiOpened(args: {
  projectId: number;
  rfiId: string;
  actorUserId: string;
}): Promise<RfiNotifyResult> {
  const { projectId, rfiId, actorUserId } = args;
  const supabase = createServiceClient();

  const { data: rfi } = await supabase
    .from("rfis")
    .select(
      "id, number, subject, question, due_date, assignees, distribution_list, rfi_manager, ball_in_court",
    )
    .eq("id", rfiId)
    .maybeSingle();
  if (!rfi) {
    return { sent: 0, failed: [{ error: "RFI not found for distribution notification." }] };
  }

  // Distribution audience = assignees + distribution list + RFI manager.
  // The creator is intentionally excluded — they just sent it.
  const { recipients, error } = await resolveRfiRecipientEmails(supabase, [
    rfi.rfi_manager,
    ...(rfi.assignees || []),
    ...(rfi.distribution_list || []),
  ]);

  if (error) {
    return { sent: 0, failed: [{ error }] };
  }
  if (recipients.length === 0) {
    return {
      sent: 0,
      failed: [{ error: "No RFI recipients with valid email addresses to distribute to." }],
    };
  }

  const [{ data: project }, createdBy] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    resolveActorName(supabase, actorUserId),
  ]);

  const projectName = project?.name || `Project #${projectId}`;
  const viewUrl = `${APP_BASE_URL}/${projectId}/rfis/${rfiId}`;
  const subject = `New RFI #${rfi.number} — ${rfi.subject}`;

  // Assignees are the people asked to answer — they get a no-login response link
  // (web) and a tokenized Reply-To (email). The distribution list / RFI manager
  // are informational (plain notification).
  const { recipients: assigneeRecipients } = await resolveRfiRecipientEmails(
    supabase,
    rfi.assignees || [],
  );
  const assigneeEmails = new Set(assigneeRecipients.map((a) => a.email));
  const replyMailbox = parseReplyMailbox(process.env.RFI_REPLY_MAILBOX);

  const results = await Promise.all(
    recipients.map(async (r) => {
      let respondUrl: string | null = null;
      let replyTo: string | undefined;
      if (assigneeEmails.has(r.email)) {
        const token = await createRfiResponseToken(supabase, {
          rfiId,
          projectId,
          recipientEmail: r.email,
          recipientName: r.name,
        });
        if (token) {
          respondUrl = `${APP_BASE_URL}/respond/rfi/${token}`;
          // When the reply mailbox is configured, replies to this email are
          // tokenized and ingested back as RFI responses (see the reply cron).
          if (replyMailbox) replyTo = buildRfiReplyAddress(replyMailbox, token);
        }
      }

      const result = await sendEmail({
        template: "rfi-notification",
        to: r.email,
        subject,
        replyTo,
        react: RFINotification({
          recipientName: r.name,
          projectName,
          rfiNumber: rfi.number,
          rfiSubject: rfi.subject,
          question: rfi.question || "",
          dueDate: rfi.due_date,
          createdBy,
          ballInCourt: rfi.ball_in_court,
          viewUrl,
          respondUrl,
          canReplyByEmail: Boolean(replyTo),
        }),
        entity: { type: "rfi", id: rfiId },
        idempotencyKey: `rfi-opened/${rfiId}/${r.email}`,
        metadata: { project_id: projectId, rfi_id: rfiId, recipient_email: r.email },
      });
      return { email: r.email, result };
    }),
  );

  const failed = results
    .filter(({ result }) => result.error)
    .map(({ email, result }) => ({
      email,
      error: result.error?.message ?? "Failed to send RFI notification.",
    }));

  const aiDecisions = await recordRfiOpenedAiNotificationDecisions({
    projectId,
    projectName,
    rfiId,
    rfiNumber: rfi.number,
    rfiSubject: rfi.subject,
    actorUserId,
    recipients,
    assigneeEmails,
    failedEmailRecipients: new Set(failed.map((failure) => failure.email).filter(Boolean) as string[]),
  });

  return { sent: results.length - failed.length, failed, aiDecisions };
}

// ── RFI updated notification ─────────────────────────────────────────────────

export async function notifyRfiUpdated(args: {
  projectId: number;
  rfiId: string;
  actorUserId: string;
  /** Human-readable summary of what changed. */
  changeSummary: string[];
}): Promise<RfiNotifyResult> {
  const { projectId, rfiId, actorUserId, changeSummary } = args;
  if (changeSummary.length === 0) {
    return { sent: 0, failed: [] };
  }
  const supabase = createServiceClient();

  const { data: rfi } = await supabase
    .from("rfis")
    .select(
      "id, number, subject, created_by, received_from, assignees, distribution_list, rfi_manager, ball_in_court, due_date",
    )
    .eq("id", rfiId)
    .maybeSingle();
  if (!rfi) {
    return { sent: 0, failed: [{ error: "RFI not found for update notification." }] };
  }

  // Update audience = everyone involved: submitter (creator + received_from),
  // reviewers (assignees + RFI manager), and the distribution list.
  const { recipients, error } = await resolveRfiRecipientEmails(supabase, [
    rfi.created_by,
    rfi.received_from,
    rfi.rfi_manager,
    ...(rfi.assignees || []),
    ...(rfi.distribution_list || []),
  ]);

  if (error) {
    return { sent: 0, failed: [{ error }] };
  }
  if (recipients.length === 0) {
    return {
      sent: 0,
      failed: [{ error: "No RFI recipients with valid email addresses to notify." }],
    };
  }

  const [{ data: project }, updatedBy] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    resolveActorName(supabase, actorUserId),
  ]);

  const projectName = project?.name || `Project #${projectId}`;
  const viewUrl = `${APP_BASE_URL}/${projectId}/rfis/${rfiId}`;
  const subject = `RFI #${rfi.number} updated — ${rfi.subject}`;

  const results = await Promise.all(
    recipients.map(async (r) => {
      const result = await sendEmail({
        template: "rfi-updated",
        to: r.email,
        subject,
        react: RFIUpdateNotification({
          recipientName: r.name,
          projectName,
          rfiNumber: rfi.number,
          rfiSubject: rfi.subject,
          updatedBy,
          changeSummary,
          ballInCourt: rfi.ball_in_court,
          dueDate: rfi.due_date,
          viewUrl,
        }),
        entity: { type: "rfi", id: rfiId },
        // Key includes the change set so distinct updates aren't de-duped, but a
        // retry of the same update is.
        idempotencyKey: `rfi-updated/${rfiId}/${r.email}/${changeSummary.join("|").slice(0, 120)}`,
        metadata: { project_id: projectId, rfi_id: rfiId, recipient_email: r.email },
      });
      return { email: r.email, result };
    }),
  );

  const failed = results
    .filter(({ result }) => result.error)
    .map(({ email, result }) => ({
      email,
      error: result.error?.message ?? "Failed to send RFI update notification.",
    }));

  return { sent: results.length - failed.length, failed };
}

// ── RFI closed notification ──────────────────────────────────────────────────

export async function notifyRfiClosed(args: {
  projectId: number;
  rfiId: string;
  closedByUserId: string;
}): Promise<RfiNotifyResult> {
  const { projectId, rfiId, closedByUserId } = args;
  const supabase = createServiceClient();

  const { data: rfi } = await supabase
    .from("rfis")
    .select("id, number, subject, created_by, assignees, distribution_list, rfi_manager")
    .eq("id", rfiId)
    .maybeSingle();
  if (!rfi) {
    return { sent: 0, failed: [{ error: "RFI not found for close notification." }] };
  }

  // Close audience = creator + assignees + distribution list + RFI manager.
  const { recipients, error } = await resolveRfiRecipientEmails(supabase, [
    rfi.created_by,
    rfi.rfi_manager,
    ...(rfi.assignees || []),
    ...(rfi.distribution_list || []),
  ]);

  if (error) {
    return { sent: 0, failed: [{ error }] };
  }
  if (recipients.length === 0) {
    return {
      sent: 0,
      failed: [{ error: "No RFI notification recipients have valid email addresses." }],
    };
  }

  const [{ data: project }, closedBy] = await Promise.all([
    supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
    resolveActorName(supabase, closedByUserId),
  ]);

  const projectName = project?.name || `Project #${projectId}`;
  const viewUrl = `${APP_BASE_URL}/${projectId}/rfis/${rfiId}`;
  const subject = `RFI #${rfi.number} closed — ${rfi.subject}`;

  const results = await Promise.all(
    recipients.map(async (r) => {
      const result = await sendEmail({
        template: "rfi-closed",
        to: r.email,
        subject,
        react: RFIClosedNotification({
          recipientName: r.name,
          projectName,
          rfiNumber: rfi.number,
          rfiSubject: rfi.subject,
          closedBy,
          viewUrl,
        }),
        entity: { type: "rfi", id: rfiId },
        idempotencyKey: `rfi-closed/${rfiId}/${r.email}`,
        metadata: { project_id: projectId, rfi_id: rfiId, recipient_email: r.email },
      });
      return { email: r.email, result };
    }),
  );

  const failed = results
    .filter(({ result }) => result.error)
    .map(({ email, result }) => ({
      email,
      error: result.error?.message ?? "Failed to send RFI close notification.",
    }));

  return { sent: results.length - failed.length, failed };
}

// ── RFI response received notification ───────────────────────────────────────

/**
 * Notify the internal team (RFI manager + creator) that a subcontractor
 * submitted a response via the no-login channel. Best-effort: the response is
 * already persisted, so a notification failure must never surface to the
 * responder. The service client is passed in by the public response endpoint
 * (which has no Supabase session of its own).
 */
export async function notifyRfiResponseReceived(
  supabase: ServiceClient,
  args: { rfiId: string; responderName: string; body: string },
): Promise<RfiNotifyResult> {
  const { rfiId, responderName, body } = args;

  const { data: rfi } = await supabase
    .from("rfis")
    .select("id, number, subject, project_id, rfi_manager, created_by")
    .eq("id", rfiId)
    .maybeSingle();
  if (!rfi) {
    return { sent: 0, failed: [{ error: "RFI not found for response notification." }] };
  }

  const { recipients, error } = await resolveRfiRecipientEmails(supabase, [
    rfi.rfi_manager,
    rfi.created_by,
  ]);
  if (error) return { sent: 0, failed: [{ error }] };
  if (recipients.length === 0) return { sent: 0, failed: [] };

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", rfi.project_id)
    .maybeSingle();

  const projectName = project?.name || `Project #${rfi.project_id}`;
  const viewUrl = `${APP_BASE_URL}/${rfi.project_id}/rfis/${rfiId}`;
  const subject = `New response on RFI #${rfi.number} — ${rfi.subject}`;

  const results = await Promise.all(
    recipients.map(async (r) => {
      const result = await sendEmail({
        template: "rfi-response-received",
        to: r.email,
        subject,
        react: RFIResponseReceivedNotification({
          recipientName: r.name,
          projectName,
          rfiNumber: rfi.number,
          rfiSubject: rfi.subject,
          responderName,
          responseExcerpt: body.length > 600 ? `${body.slice(0, 600)}…` : body,
          viewUrl,
        }),
        entity: { type: "rfi", id: rfiId },
        metadata: { project_id: rfi.project_id, rfi_id: rfiId, recipient_email: r.email },
      });
      return { email: r.email, result };
    }),
  );

  const failed = results
    .filter(({ result }) => result.error)
    .map(({ email, result }) => ({
      email,
      error: result.error?.message ?? "Failed to send RFI response notification.",
    }));

  return { sent: results.length - failed.length, failed };
}
