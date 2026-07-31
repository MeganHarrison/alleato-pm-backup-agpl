import { tool } from "ai";
import {
  createOutlookCalendarInviteDescription,
  createOutlookCalendarInviteInputSchema,
  draftOutlookEmailDescription,
  draftOutlookEmailInputSchema,
  sendTeamsMessageDescription,
  sendTeamsMessageInputSchema,
} from "@/lib/ai/tool-descriptors";
import {
  buildCalendarInviteAdaptiveCard,
  createOutlookCalendarInvite,
  resolveOutlookOrganizerEmail,
} from "@/lib/microsoft-graph/calendar-invites";
import {
  buildOutlookMailDraftAdaptiveCard,
  createOutlookMailDraft,
  resolveOutlookMailboxUserId,
} from "@/lib/microsoft-graph/mail";
import { type ActionToolInternals, withWriteTrace } from "./action-tool-internals";

const BRANDON_EMAIL_VOICE_PROFILE = {
  path: "docs/architecture/memory/brandon-brand-voice/brandon-email-voice-profile.md",
  version: "2026-05-19",
  companionResources: [
    "docs/architecture/memory/brandon-brand-voice/brandon-operating-profile.md",
    "docs/architecture/memory/brandon-brand-voice/brandon-email-drafting-playbook.md",
  ],
  summary:
    "For Brandon's Outlook drafts, write short, direct, action-oriented replies grounded in the current thread. Start with the ask or answer, preserve cost/scope/schedule facts, use plain construction/business language, and turn weak evidence into a direct confirmation question.",
} as const;

export function createCommunicationWriteTools(internals: ActionToolInternals) {
  const {
    options,
    supabase,
    resolveIdempotencyKey,
    getReplayResponse,
    recordWriteAudit,
    enforceProjectWriteAccess,
  } = internals;

  return {
    createOutlookCalendarInvite: tool({
      description: createOutlookCalendarInviteDescription,
      inputSchema: createOutlookCalendarInviteInputSchema,
      execute: withWriteTrace("createOutlookCalendarInvite", options, async (input) => {
        if (typeof input.projectId === "number") {
          const access = await enforceProjectWriteAccess(input.projectId);
          if (!access.ok) return { success: false, error: access.error };
        }

        let organizerEmail: string;
        try {
          organizerEmail = resolveOutlookOrganizerEmail(input.organizerEmail);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            widget: {
              type: "calendar_invite",
              id: "outlook-calendar-invite-blocked",
              title: "Calendar invite blocked",
              status: "blocked",
              organizerEmail: input.organizerEmail ?? null,
              subject: input.subject,
              body: input.body,
              startDateTime: input.startDateTime,
              endDateTime: input.endDateTime,
              timeZone: input.timeZone,
              location: input.location,
              attendees: input.attendees,
              adaptiveCard: buildCalendarInviteAdaptiveCard({
                title: input.subject,
                startLabel: input.startDateTime,
                endLabel: input.endDateTime,
                location: input.location,
                attendeeLabel: `${input.attendees.length} attendee${input.attendees.length === 1 ? "" : "s"}`,
                status: "blocked",
              }),
              confirmPrompt: "Fix the Outlook calendar configuration before creating this invite.",
            },
          };
        }

        const attendeeLabel = `${input.attendees.length} attendee${input.attendees.length === 1 ? "" : "s"}`;
        const adaptiveCard = buildCalendarInviteAdaptiveCard({
          title: input.subject,
          startLabel: input.startDateTime,
          endLabel: input.endDateTime,
          location: input.location,
          attendeeLabel,
          status: input.confirmed ? "created" : "draft",
        });

        if (!input.confirmed) {
          return {
            action: "preview",
            message: "Here's the Outlook calendar invite I'll create. Reply **confirm** to send it.",
            subject: input.subject,
            body: input.body,
            organizerEmail,
            startDateTime: input.startDateTime,
            endDateTime: input.endDateTime,
            timeZone: input.timeZone,
            location: input.location,
            attendees: input.attendees,
            adaptiveCard,
            widget: {
              type: "calendar_invite",
              id: "outlook-calendar-invite-preview",
              title: "Outlook calendar invite",
              status: "draft",
              organizerEmail,
              subject: input.subject,
              body: input.body,
              startDateTime: input.startDateTime,
              endDateTime: input.endDateTime,
              timeZone: input.timeZone,
              location: input.location,
              attendees: input.attendees,
              adaptiveCard,
              confirmPrompt: "Confirm this Outlook calendar invite and create it with createOutlookCalendarInvite.",
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("createOutlookCalendarInvite", input);
        const replay = await getReplayResponse("createOutlookCalendarInvite", idempotencyKey);
        if (replay) return replay;

        try {
          const event = await createOutlookCalendarInvite({
            organizerEmail,
            subject: input.subject,
            body: input.body,
            startDateTime: input.startDateTime,
            endDateTime: input.endDateTime,
            timeZone: input.timeZone,
            location: input.location,
            attendees: input.attendees,
            isOnlineMeeting: input.isOnlineMeeting,
            transactionId: idempotencyKey,
          });
          const createdAdaptiveCard = buildCalendarInviteAdaptiveCard({
            title: event.subject,
            startLabel: event.startDateTime,
            endLabel: event.endDateTime,
            location: input.location,
            attendeeLabel,
            status: "created",
            openUrl: event.webLink,
          });
          const response = {
            success: true,
            message: `Outlook invite **${event.subject}** created for ${attendeeLabel}.`,
            outlookEventId: event.id,
            outlookWebLink: event.webLink,
            teamsJoinUrl: event.joinUrl,
            organizerEmail: event.organizerEmail,
            subject: event.subject,
            body: input.body,
            startDateTime: event.startDateTime,
            endDateTime: event.endDateTime,
            timeZone: event.timeZone,
            location: input.location,
            attendees: input.attendees,
            adaptiveCard: createdAdaptiveCard,
            widget: {
              type: "calendar_invite",
              id: event.id,
              title: "Outlook calendar invite",
              status: "created",
              organizerEmail: event.organizerEmail,
              subject: event.subject,
              body: input.body,
              startDateTime: event.startDateTime,
              endDateTime: event.endDateTime,
              timeZone: event.timeZone,
              location: input.location,
              attendees: input.attendees,
              outlookEventId: event.id,
              outlookWebLink: event.webLink,
              teamsJoinUrl: event.joinUrl,
              adaptiveCard: createdAdaptiveCard,
              confirmPrompt: "Outlook calendar invite created.",
            },
          };
          await recordWriteAudit({
            toolName: "createOutlookCalendarInvite",
            idempotencyKey,
            projectId: input.projectId ?? null,
            input,
            status: "success",
            response,
          });
          return response;
        } catch (error) {
          const failure = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            subject: input.subject,
            organizerEmail,
          };
          await recordWriteAudit({
            toolName: "createOutlookCalendarInvite",
            idempotencyKey,
            projectId: input.projectId ?? null,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }
      }),
    }),

    draftOutlookEmail: tool({
      description: draftOutlookEmailDescription,
      inputSchema: draftOutlookEmailInputSchema,
      execute: withWriteTrace("draftOutlookEmail", options, async (input) => {
        const access = await enforceProjectWriteAccess(input.projectId);
        if (!access.ok) return { success: false, error: access.error };

        let mailboxUserId: string;
        try {
          mailboxUserId = resolveOutlookMailboxUserId(input.mailboxUserId);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            widget: {
              type: "outlook_email_draft",
              id: "outlook-email-draft-blocked",
              title: "Outlook email draft blocked",
              status: "blocked",
              mailboxUserId: input.mailboxUserId ?? null,
              mode: input.replyToGraphMessageId ? "reply" : "new_message",
              subject: input.subject,
              body: input.body,
              toRecipients: input.toRecipients,
              ccRecipients: input.ccRecipients,
              bccRecipients: input.bccRecipients,
              adaptiveCard: buildOutlookMailDraftAdaptiveCard({
                title: input.subject,
                mailboxUserId: input.mailboxUserId ?? "not configured",
                recipientLabel: `${input.toRecipients.length} recipient${input.toRecipients.length === 1 ? "" : "s"}`,
                status: "blocked",
                mode: input.replyToGraphMessageId ? "reply" : "new_message",
              }),
              confirmPrompt: "Fix the Outlook mail configuration before creating this draft.",
            },
          };
        }

        const mode = input.replyToGraphMessageId ? "reply" : "new_message";
        const recipientCount =
          input.toRecipients.length +
          input.ccRecipients.length +
          input.bccRecipients.length;
        const recipientLabel = mode === "reply" && recipientCount === 0
          ? "inferred from original message"
          : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`;
        const adaptiveCard = buildOutlookMailDraftAdaptiveCard({
          title: input.subject,
          mailboxUserId,
          recipientLabel,
          status: input.confirmed ? "created" : "draft",
          mode,
        });

        if (!input.confirmed) {
          return {
            action: "preview",
            message: "Here's the Outlook email draft I'll create. Reply **confirm** to save it to Outlook drafts.",
            mailboxUserId,
            mode,
            subject: input.subject,
            body: input.body,
            toRecipients: input.toRecipients,
            ccRecipients: input.ccRecipients,
            bccRecipients: input.bccRecipients,
            replyToGraphMessageId: input.replyToGraphMessageId ?? null,
            voiceProfile: BRANDON_EMAIL_VOICE_PROFILE,
            adaptiveCard,
            widget: {
              type: "outlook_email_draft",
              id: "outlook-email-draft-preview",
              title: "Outlook email draft",
              status: "draft",
              mailboxUserId,
              mode,
              subject: input.subject,
              body: input.body,
              toRecipients: input.toRecipients,
              ccRecipients: input.ccRecipients,
              bccRecipients: input.bccRecipients,
              replyToGraphMessageId: input.replyToGraphMessageId ?? null,
              voiceProfile: BRANDON_EMAIL_VOICE_PROFILE,
              adaptiveCard,
              confirmPrompt: "Confirm this Outlook email draft and create it with draftOutlookEmail.",
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("draftOutlookEmail", input);
        const replay = await getReplayResponse("draftOutlookEmail", idempotencyKey);
        if (replay) return replay;

        try {
          const draft = await createOutlookMailDraft({
            mailboxUserId,
            replyToGraphMessageId: input.replyToGraphMessageId,
            subject: input.subject,
            body: input.body,
            toRecipients: input.toRecipients,
            ccRecipients: input.ccRecipients,
            bccRecipients: input.bccRecipients,
            importance: input.importance,
          });
          const createdAdaptiveCard = buildOutlookMailDraftAdaptiveCard({
            title: draft.subject,
            mailboxUserId: draft.mailboxUserId,
            recipientLabel,
            status: "created",
            mode: draft.mode,
            openUrl: draft.webLink,
          });
          const response = {
            success: true,
            message: `Outlook draft **${draft.subject}** created in ${draft.mailboxUserId}.`,
            outlookDraftId: draft.id,
            outlookWebLink: draft.webLink,
            mailboxUserId: draft.mailboxUserId,
            mode: draft.mode,
            subject: draft.subject,
            body: input.body,
            toRecipients: input.toRecipients,
            ccRecipients: input.ccRecipients,
            bccRecipients: input.bccRecipients,
            replyToGraphMessageId: input.replyToGraphMessageId ?? null,
            voiceProfile: BRANDON_EMAIL_VOICE_PROFILE,
            adaptiveCard: createdAdaptiveCard,
            widget: {
              type: "outlook_email_draft",
              id: draft.id,
              title: "Outlook email draft",
              status: "created",
              mailboxUserId: draft.mailboxUserId,
              mode: draft.mode,
              subject: draft.subject,
              body: input.body,
              toRecipients: input.toRecipients,
              ccRecipients: input.ccRecipients,
              bccRecipients: input.bccRecipients,
              replyToGraphMessageId: input.replyToGraphMessageId ?? null,
              voiceProfile: BRANDON_EMAIL_VOICE_PROFILE,
              outlookDraftId: draft.id,
              outlookWebLink: draft.webLink,
              adaptiveCard: createdAdaptiveCard,
              confirmPrompt: "Outlook email draft created. Open it in Outlook to review and send.",
            },
          };
          await recordWriteAudit({
            toolName: "draftOutlookEmail",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "success",
            response,
          });
          return response;
        } catch (error) {
          const failure = {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            subject: input.subject,
            mailboxUserId,
          };
          await recordWriteAudit({
            toolName: "draftOutlookEmail",
            idempotencyKey,
            projectId: access.projectId,
            input,
            status: "error",
            response: failure,
          });
          return failure;
        }
      }),
    }),

    sendTeamsMessage: tool({
      description: sendTeamsMessageDescription,
      inputSchema: sendTeamsMessageInputSchema,
      execute: withWriteTrace("sendTeamsMessage", options, async (input) => {
        const { recipientName, recipientEmail, message, confirmed } = input;

        // Resolve person → user_profiles ID
        const query = supabase
          .from("people")
          .select("id, first_name, last_name, email")
          .limit(5);

        if (recipientEmail) {
          query.ilike("email", recipientEmail);
        } else {
          // Try first+last split
          const parts = recipientName.trim().split(/\s+/);
          if (parts.length >= 2) {
            query.ilike("first_name", `%${parts[0]}%`).ilike("last_name", `%${parts[parts.length - 1]}%`);
          } else {
            query.or(`first_name.ilike.%${parts[0]}%,last_name.ilike.%${parts[0]}%`);
          }
        }

        const { data: people, error: peopleError } = await query;

        if (peopleError) {
          return { success: false, error: `Failed to look up recipient: ${peopleError.message}` };
        }

        if (!people || people.length === 0) {
          return {
            success: false,
            error: `No person found matching "${recipientName}". Check the name and try again.`,
          };
        }

        // Match to a Supabase user via email
        const emails = people.map((p) => p.email).filter(Boolean) as string[];
        const { data: userProfiles } = await supabase
          .from("user_profiles")
          .select("id, email")
          .in("email", emails)
          .limit(5);

        const userProfileMap = new Map((userProfiles ?? []).map((u) => [u.email, u.id]));
        const matchedPerson = people.find((p) => p.email && userProfileMap.has(p.email));
        const supabaseUserId = matchedPerson?.email ? userProfileMap.get(matchedPerson.email) ?? null : null;

        if (!supabaseUserId) {
          return {
            success: false,
            error:
              `Found ${people[0].first_name} ${people[0].last_name} in the directory but they don't have an Alleato login. ` +
              "They need an account and must have messaged the Archon bot in Teams to receive messages.",
          };
        }

        // Check Teams conversation ref exists
        const { data: ref } = await supabase
          .from("teams_conversation_refs")
          .select("supabase_user_id")
          .eq("supabase_user_id", supabaseUserId)
          .maybeSingle();

        if (!ref) {
          const name = [matchedPerson?.first_name, matchedPerson?.last_name].filter(Boolean).join(" ");
          return {
            success: false,
            error:
              `${name} hasn't linked their Teams account yet — they need to message the Archon bot in Teams at least once before they can receive proactive messages.`,
          };
        }

        const recipientFullName = [matchedPerson?.first_name, matchedPerson?.last_name]
          .filter(Boolean)
          .join(" ");

        if (!confirmed) {
          return {
            action: "preview",
            message: `I'll send this Teams message to **${recipientFullName}**. Reply **confirm** to send.`,
            preview: {
              recipient: recipientFullName,
              recipientEmail: matchedPerson?.email,
              platform: "Microsoft Teams",
              message,
            },
          };
        }

        const idempotencyKey = resolveIdempotencyKey("sendTeamsMessage", input);
        const replay = await getReplayResponse("sendTeamsMessage", idempotencyKey);
        if (replay) return replay;

        const { sendProactiveMessage } = await import(
          "@/lib/bot/teams-delivery"
        );
        await sendProactiveMessage(supabaseUserId, message);

        const response = {
          success: true,
          message: `Teams message sent to **${recipientFullName}**.`,
          recipient: recipientFullName,
          recipientEmail: matchedPerson?.email,
        };
        await recordWriteAudit({
          toolName: "sendTeamsMessage",
          idempotencyKey,
          projectId: null,
          input,
          status: "success",
          response,
        });
        return response;
      }),
    }),
  };
}
