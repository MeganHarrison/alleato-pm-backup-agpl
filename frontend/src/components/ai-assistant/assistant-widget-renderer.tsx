"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CheckCircle2Icon,
  ClipboardIcon,
  CornerUpLeftIcon,
  FileTextIcon,
  FolderIcon,
  GitBranchIcon,
  ListChecksIcon,
  Loader2Icon,
  MailIcon,
  PaperclipIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquarePenIcon,
  TagIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TrendingUpIcon,
  UserIcon,
  UsersRoundIcon,
} from "lucide-react";
import { toast } from "sonner";

import { InfoAlert } from "@/components/ds/InfoAlert";
import { TaskFeedbackButtons } from "@/components/ai/TaskFeedbackButtons";
import { MoneyField } from "@/components/forms/MoneyField";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { copyTextWithFallback } from "@/lib/browser/clipboard";
import type {
  AssistantWidgetField,
  AssistantWidgetPayload,
  CalendarInviteWidgetPayload,
  ChangeEventWorkflowWidgetPayload,
  CommitmentDraftWidgetPayload,
  CreateContactWidgetPayload,
  CreateEventWidgetPayload,
  CreateTaskWidgetPayload,
  CreativeDraftWidgetPayload,
  DecisionPacketWidgetPayload,
  DraftEmailWidgetPayload,
  ExecutiveDailyBriefWidgetPayload,
  FinancialPulseWidgetPayload,
  MeetingIntelligenceWidgetPayload,
  MeetingInsightsWidgetPayload,
  OutlookEmailDraftWidgetPayload,
  OutlookInboxSummaryWidgetPayload,
  OwnerActionQueueWidgetPayload,
  OwnerSnapshotWidgetPayload,
  ProjectActionPreviewWidgetPayload,
  ProjectPickerWidgetPayload,
  PrimeContractDraftWidgetPayload,
  RecordWritePreviewWidgetPayload,
  RiskExposurePacketWidgetPayload,
  SourceEvidenceDrawerWidgetPayload,
  TaskSummaryWidgetPayload,
} from "@/lib/ai/assistant-widgets";
import type { FeatureRequestPacketWidgetPayload } from "@/lib/feature-requests/types";

type SourceItem = {
  document_id?: string;
  snippet?: string;
  metadata?: {
    id?: string;
    meeting_id?: string;
    metadata_id?: string;
    file_id?: string;
    project_id?: number | string;
    type?: string;
    category?: string;
    source?: string;
    url?: string;
    fireflies_link?: string;
    title?: string;
    doc_type?: string;
  };
};

type AssistantWidgetRendererProps = {
  widget: AssistantWidgetPayload;
  selectedProjectId?: number | null;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
};

function WidgetShell({
  title,
  icon,
  eyebrow,
  children,
  actions,
  className,
}: {
  title: string;
  icon?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "mb-3 overflow-hidden rounded-xl bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {eyebrow}
              </div>
            ) : null}
            <div className="truncate text-sm font-semibold text-foreground">
              {title}
            </div>
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="space-y-3 px-4 pb-4 pt-1">{children}</div>
    </section>
  );
}

function WidgetMeta({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
        tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-background/80 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

async function copyToClipboard(text: string) {
  try {
    await copyTextWithFallback(text);
    toast.success("Copied");
  } catch (error) {
    toast.error("Copy failed", {
      description:
        error instanceof Error
          ? error.message
          : "The browser denied clipboard access. Select the content manually and copy it.",
    });
  }
}

function DraftEmailWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: DraftEmailWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [to, setTo] = useState(widget.defaultTo);
  const [subject, setSubject] = useState(widget.defaultSubject);
  const [body, setBody] = useState(widget.defaultBody);

  const draft = useMemo(
    () =>
      [
        "Email draft",
        `To: ${to || "[recipient needed]"}`,
        `Subject: ${subject || "[subject needed]"}`,
        "",
        body || "[body needed]",
      ].join("\n"),
    [body, subject, to],
  );

  return (
    <WidgetShell
      eyebrow="Editable draft"
      title={widget.title}
      icon={<MailIcon className="h-4 w-4" />}
      actions={<WidgetMeta>Email</WidgetMeta>}
    >
      {widget.emailFrom ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">From</span>
          <span className="truncate text-muted-foreground">{widget.emailFrom}</span>
        </div>
      ) : null}
      <div className="grid gap-2">
        <label className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">To</span>
          <Input value={to} onChange={(event) => setTo(event.target.value)} placeholder="name@example.com" />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">Subject</span>
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" />
        </label>
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your message"
          className="min-h-40 resize-y"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(`Use this email draft and prepare it for sending:\n\n${draft}`)}>
          <SendIcon className="h-4 w-4" />
          Stage send
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(draft)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(draft)}>
          <ClipboardIcon className="h-4 w-4" />
          Copy
        </Button>
      </div>
    </WidgetShell>
  );
}

function recipientsToText(
  recipients: OutlookEmailDraftWidgetPayload["toRecipients"] = [],
) {
  return recipients
    .map((recipient) => recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email)
    .join("\n");
}

function recipientTextToRows(value: string): OutlookEmailDraftWidgetPayload["toRecipients"] {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)\s*<([^>]+)>$/);
      const email = (match?.[2] ?? item).trim().toLowerCase();
      const name = match?.[1]?.trim() || undefined;
      return { email, name };
    });
}

type EmailDraftFeedbackSignal = "good" | "bad" | "accepted" | "edited" | "ignored";
type EmailDraftFeedbackReasonCategory =
  | "too_formal"
  | "too_long"
  | "too_short"
  | "too_soft"
  | "too_direct"
  | "wrong_tone"
  | "wrong_assumption"
  | "missing_context"
  | "good_tone"
  | "good_structure"
  | "other";

function EmailDraftFeedbackControls({
  widget,
  subject,
  body,
  toRecipients,
  ccRecipients,
}: {
  widget: OutlookEmailDraftWidgetPayload;
  subject: string;
  body: string;
  toRecipients: OutlookEmailDraftWidgetPayload["toRecipients"];
  ccRecipients: OutlookEmailDraftWidgetPayload["toRecipients"];
}) {
  const graphDraftMessageId = widget.outlookDraftId ?? widget.id;
  const [submittedLabel, setSubmittedLabel] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  if (widget.status !== "created" || !graphDraftMessageId || graphDraftMessageId === "outlook-email-draft-preview") {
    return null;
  }

  const draftSnapshot = {
    subject,
    body,
    toRecipients,
    ccRecipients,
    mailboxUserId: widget.mailboxUserId ?? null,
    mode: widget.mode,
  };

  const submitFeedback = async (
    signal: EmailDraftFeedbackSignal,
    reasonCategory: EmailDraftFeedbackReasonCategory,
    label: string,
    text?: string,
  ) => {
    if (!widget.mailboxUserId) {
      toast.error("Mailbox is missing, so draft feedback could not be recorded.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch("/api/ai-assistant/email-draft-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxUserId: widget.mailboxUserId,
          graphDraftMessageId,
          graphSourceMessageId: widget.replyToGraphMessageId ?? null,
          subject,
          signal,
          reasonCategory,
          feedbackText: text?.trim() || undefined,
          draftSnapshot,
          voiceProfilePath: widget.voiceProfile?.path,
          voiceProfileVersion: widget.voiceProfile?.version,
          metadata: {
            widgetId: widget.id,
            outlookWebLink: widget.outlookWebLink ?? null,
          },
        }),
      });
      setSubmittedLabel(label);
      setFeedbackOpen(false);
      setFeedbackText("");
      toast.success("Draft feedback recorded");
    } catch (error) {
      toast.error("Draft feedback could not be recorded");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedLabel) {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">
        <span>Draft feedback recorded</span>
        <span className="font-medium text-foreground">{submittedLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
      <Button
        size="sm"
        variant="ghost"
        disabled={isSubmitting}
        onClick={() => submitFeedback("good", "good_tone", "Good tone")}
      >
        {isSubmitting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <ThumbsUpIcon className="h-4 w-4" />}
        Good tone
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isSubmitting}
        onClick={() => submitFeedback("edited", "too_formal", "Too formal")}
      >
        <ThumbsDownIcon className="h-4 w-4" />
        Too formal
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isSubmitting}
        onClick={() => submitFeedback("edited", "too_long", "Too long")}
      >
        <ThumbsDownIcon className="h-4 w-4" />
        Too long
      </Button>
      <Popover open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" disabled={isSubmitting}>
            <SquarePenIcon className="h-4 w-4" />
            More feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" collisionPadding={16} className="w-80 p-3">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">What should change?</p>
              <p className="text-xs text-muted-foreground">This updates future Brandon draft guidance.</p>
            </div>
            <Textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Too soft, missed context, wrong assumption..."
              className="min-h-24 resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setFeedbackOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={() => submitFeedback("edited", "other", "Custom feedback", feedbackText)}
              >
                {isSubmitting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OutlookEmailDraftWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: OutlookEmailDraftWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [toRecipients, setToRecipients] = useState(recipientsToText(widget.toRecipients));
  const [ccRecipients, setCcRecipients] = useState(recipientsToText(widget.ccRecipients));
  const [subject, setSubject] = useState(widget.subject);
  const [body, setBody] = useState(widget.body);
  const toRows = useMemo(() => recipientTextToRows(toRecipients), [toRecipients]);
  const ccRows = useMemo(() => recipientTextToRows(ccRecipients), [ccRecipients]);
  const recipientCount = toRows.length + ccRows.length + (widget.bccRecipients?.length ?? 0);
  const recipientLabel = widget.mode === "reply" && recipientCount === 0
    ? "inferred from original message"
    : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`;
  const draft = useMemo(
    () =>
      [
        "Outlook email draft",
        `Mailbox: ${widget.mailboxUserId || "[use configured Outlook mailbox]"}`,
        `Mode: ${widget.mode === "reply" ? "Reply draft" : "New message draft"}`,
        widget.replyToGraphMessageId ? `Reply to Graph message: ${widget.replyToGraphMessageId}` : null,
        `To: ${toRows.map((recipient) => recipient.email).join(", ") || (widget.mode === "reply" ? "[inferred from original message]" : "[recipient needed]")}`,
        ccRows.length ? `Cc: ${ccRows.map((recipient) => recipient.email).join(", ")}` : null,
        `Subject: ${subject || "[subject needed]"}`,
        "",
        body || "[body needed]",
      ]
        .filter((line): line is string => typeof line === "string")
        .join("\n"),
    [body, ccRows, subject, toRows, widget.mailboxUserId, widget.mode, widget.replyToGraphMessageId],
  );
  const previewPrompt = [
    "Create this Outlook email draft with draftOutlookEmail.",
    "First show the final preview/adaptive-card widget and wait for my confirmation.",
    "",
    draft,
  ].join("\n");

  return (
    <WidgetShell
      eyebrow={widget.status === "created" ? "Outlook draft created" : "Outlook draft"}
      title={widget.title}
      icon={<MailIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.status}</WidgetMeta>}
    >
      <div className="grid gap-2">
        <label className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">Mailbox</span>
          <Input value={widget.mailboxUserId ?? ""} readOnly placeholder="Configured Outlook mailbox" />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs font-medium uppercase text-muted-foreground">Subject</span>
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Email subject" />
        </label>
        <Textarea
          value={toRecipients}
          onChange={(event) => setToRecipients(event.target.value)}
          placeholder={widget.mode === "reply" ? "Reply recipients are inferred" : "recipient@example.com"}
          className="min-h-16 resize-y"
        />
        <Textarea
          value={ccRecipients}
          onChange={(event) => setCcRecipients(event.target.value)}
          placeholder="cc@example.com"
          className="min-h-16 resize-y"
        />
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write your message"
          className="min-h-40 resize-y"
        />
      </div>

      <div className="divide-y divide-border/70">
        {[
          ["Mode", widget.mode === "reply" ? "Reply draft" : "New message"],
          ["Recipients", recipientLabel],
          ["Status", widget.status],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
            <span className="truncate text-right text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {widget.outlookWebLink ? (
        <Button size="sm" asChild>
          <Link href={widget.outlookWebLink}>
            <MailIcon className="h-4 w-4" />
            Open Outlook
          </Link>
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onSubmit(previewPrompt)}>
            <SendIcon className="h-4 w-4" />
            Create preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEditDraft(draft)}>
            <SquarePenIcon className="h-4 w-4" />
            Edit in chat
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(draft)}>
            <ClipboardIcon className="h-4 w-4" />
            Copy
          </Button>
        </div>
      )}
      <EmailDraftFeedbackControls
        widget={widget}
        subject={subject}
        body={body}
        toRecipients={toRows}
        ccRecipients={ccRows}
      />
    </WidgetShell>
  );
}

function toDatetimeLocalValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  return value.slice(0, 16);
}

function attendeeTextToRows(value: string): CalendarInviteWidgetPayload["attendees"] {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)\s*<([^>]+)>$/);
      const email = (match?.[2] ?? item).trim().toLowerCase();
      const name = match?.[1]?.trim() || undefined;
      return { email, name, type: "required" as const };
    });
}

function CalendarInviteWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: CalendarInviteWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [subject, setSubject] = useState(widget.subject);
  const [body, setBody] = useState(widget.body);
  const [startDateTime, setStartDateTime] = useState(toDatetimeLocalValue(widget.startDateTime));
  const [endDateTime, setEndDateTime] = useState(toDatetimeLocalValue(widget.endDateTime));
  const [location, setLocation] = useState(widget.location);
  const [attendees, setAttendees] = useState(
    widget.attendees
      .map((attendee) => attendee.name ? `${attendee.name} <${attendee.email}>` : attendee.email)
      .join("\n"),
  );

  const attendeeRows = useMemo(() => attendeeTextToRows(attendees), [attendees]);
  const draft = useMemo(
    () =>
      [
        "Outlook calendar invite",
        `Organizer: ${widget.organizerEmail || "[use configured Outlook calendar organizer]"}`,
        `Subject: ${subject || "[subject needed]"}`,
        `Start: ${startDateTime || "[start date/time needed]"}`,
        `End: ${endDateTime || "[end date/time needed]"}`,
        `Time zone: ${widget.timeZone}`,
        `Location: ${location || "Microsoft Teams"}`,
        `Attendees: ${attendeeRows.map((attendee) => attendee.email).join(", ") || "[attendees needed]"}`,
        "",
        body || "[agenda/body needed]",
      ].join("\n"),
    [attendeeRows, body, endDateTime, location, startDateTime, subject, widget.organizerEmail, widget.timeZone],
  );
  const previewPrompt = [
    "Create this Outlook calendar invite with createOutlookCalendarInvite.",
    "First show the final preview/adaptive-card widget and wait for my confirmation.",
    "",
    draft,
  ].join("\n");

  return (
    <WidgetShell
      eyebrow={widget.status === "created" ? "Outlook invite created" : "Adaptive card draft"}
      title={widget.title}
      icon={<CalendarClockIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.status}</WidgetMeta>}
    >
      <div className="grid gap-2">
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Meeting subject" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            type="datetime-local"
            value={startDateTime}
            onChange={(event) => setStartDateTime(event.target.value)}
          />
          <Input
            type="datetime-local"
            value={endDateTime}
            onChange={(event) => setEndDateTime(event.target.value)}
          />
        </div>
        <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Microsoft Teams" />
        <Textarea
          value={attendees}
          onChange={(event) => setAttendees(event.target.value)}
          placeholder="attendee@example.com"
          className="min-h-20 resize-y"
        />
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Agenda or invite body"
          className="min-h-28 resize-y"
        />
      </div>

      <div className="divide-y divide-border/70">
        {[
          ["Start", startDateTime || "Needs date/time"],
          ["End", endDateTime || "Needs date/time"],
          ["Location", location || "Microsoft Teams"],
          ["Attendees", attendeeRows.length ? `${attendeeRows.length} recipient${attendeeRows.length === 1 ? "" : "s"}` : "Needs attendees"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
            <span className="truncate text-right text-foreground">{value}</span>
          </div>
        ))}
      </div>

      {widget.outlookWebLink || widget.teamsJoinUrl ? (
        <div className="flex flex-wrap gap-2">
          {widget.outlookWebLink ? (
            <Button size="sm" asChild>
              <Link href={widget.outlookWebLink}>
                <CalendarIcon className="h-4 w-4" />
                Open Outlook
              </Link>
            </Button>
          ) : null}
          {widget.teamsJoinUrl ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={widget.teamsJoinUrl}>
                <UsersRoundIcon className="h-4 w-4" />
                Join Teams
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onSubmit(previewPrompt)}>
            <CalendarClockIcon className="h-4 w-4" />
            Create preview
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEditDraft(draft)}>
            <SquarePenIcon className="h-4 w-4" />
            Edit in chat
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(draft)}>
            <ClipboardIcon className="h-4 w-4" />
            Copy
          </Button>
        </div>
      )}
    </WidgetShell>
  );
}

function CreateTaskWidget({
  widget,
  selectedProjectId,
  onSubmit,
  onEditDraft,
}: {
  widget: CreateTaskWidgetPayload;
  selectedProjectId?: number | null;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [title, setTitle] = useState(widget.defaultTitle);
  const [body, setBody] = useState(widget.defaultBody);
  const [dueDate, setDueDate] = useState(widget.defaultDueDate ?? "");
  const [assignee, setAssignee] = useState(widget.defaultAssignee ?? "");
  const projectId = selectedProjectId ?? widget.projectId ?? null;
  const taskPrompt = [
    "Create this as a Tasks page task using createGeneratedTask. Show the final write preview first and wait for my confirmation.",
    `Project ID: ${projectId ?? "[resolve project first]"}`,
    `Title: ${title}`,
    `Assignee: ${assignee || "Unassigned"}`,
    `Due date: ${dueDate || "No due date"}`,
    `Priority: ${widget.defaultPriority}`,
    "",
    body,
  ].join("\n");

  return (
    <WidgetShell
      eyebrow="Action draft"
      title={widget.title}
      icon={<CheckCircle2Icon className="h-4 w-4" />}
      actions={<WidgetMeta>Task</WidgetMeta>}
    >
      {!projectId ? (
        <InfoAlert variant="warning">
          <span>Select or resolve a project before this can become a real task.</span>
        </InfoAlert>
      ) : null}
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 resize-y" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Assignee" />
        <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(taskPrompt)}>
          <CheckCircle2Icon className="h-4 w-4" />
          Create preview
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(taskPrompt)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
      </div>
    </WidgetShell>
  );
}

function ContactField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function CreateContactWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: CreateContactWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [firstName, setFirstName] = useState(widget.defaultFirstName ?? "");
  const [lastName, setLastName] = useState(widget.defaultLastName ?? "");
  const [company, setCompany] = useState(widget.defaultCompanyName ?? "");
  const [jobTitle, setJobTitle] = useState(widget.defaultJobTitle ?? "");
  const [email, setEmail] = useState(widget.defaultEmail ?? "");
  const [phone, setPhone] = useState(widget.defaultPhone ?? "");
  const [department, setDepartment] = useState(widget.defaultDepartment ?? "");
  const [notes, setNotes] = useState(widget.defaultNotes ?? "");

  const created = widget.status === "created";

  const submitPrompt = useMemo(
    () =>
      [
        "Create this contact in the directory with createContact and confirmed=true. Use exactly these values:",
        `First name: ${firstName || "[required]"}`,
        `Last name: ${lastName || "[required]"}`,
        `Company: ${company || "(none)"}`,
        widget.companyId ? `Company ID: ${widget.companyId}` : null,
        `Job title: ${jobTitle || "(none)"}`,
        `Email: ${email || "(none)"}`,
        `Phone: ${phone || "(none)"}`,
        `Department: ${department || "(none)"}`,
        `Notes: ${notes || "(none)"}`,
      ]
        .filter((line): line is string => typeof line === "string")
        .join("\n"),
    [company, department, email, firstName, jobTitle, lastName, notes, phone, widget.companyId],
  );

  return (
    <WidgetShell
      eyebrow={created ? "Contact created" : "New contact"}
      title={widget.title}
      icon={<UserIcon className="h-4 w-4 text-primary" />}
      actions={<SparklesIcon className="h-4 w-4 text-primary" aria-hidden="true" />}
    >
      {created ? (
        <InfoAlert variant="success">
          <span>
            {firstName} {lastName} was added to the directory.
          </span>
        </InfoAlert>
      ) : null}

      <div className="grid gap-3">
        <ContactField label="Company">
          <Input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Search or enter company"
            disabled={created}
          />
        </ContactField>

        <div className="grid gap-3 sm:grid-cols-2">
          <ContactField label="First name">
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="John"
              disabled={created}
            />
          </ContactField>
          <ContactField label="Last name">
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Smith"
              disabled={created}
            />
          </ContactField>
        </div>

        <ContactField label="Job title">
          <Input
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
            placeholder="Project Manager"
            disabled={created}
          />
        </ContactField>

        <div className="grid gap-3 sm:grid-cols-2">
          <ContactField label="Email">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              disabled={created}
            />
          </ContactField>
          <ContactField label="Phone">
            <Input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="(317) 555-1234"
              disabled={created}
            />
          </ContactField>
        </div>

        <ContactField label="Department">
          <Input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="Operations"
            disabled={created}
          />
        </ContactField>

        <ContactField label="Notes">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Responsibilities, relationship context..."
            className="min-h-20 resize-y"
            disabled={created}
          />
        </ContactField>
      </div>

      {created ? (
        widget.contactHref ? (
          <Button size="sm" asChild>
            <Link href={widget.contactHref}>
              <UserIcon className="h-4 w-4" />
              View contact
            </Link>
          </Button>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!firstName.trim() || !lastName.trim()}
            onClick={() => onSubmit(submitPrompt)}
          >
            <UserIcon className="h-4 w-4" />
            Create contact
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEditDraft(submitPrompt)}>
            <SquarePenIcon className="h-4 w-4" />
            Edit in chat
          </Button>
        </div>
      )}
    </WidgetShell>
  );
}

function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(Number(year), Number(month) - 1, Number(day)));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

type TaskItem = TaskSummaryWidgetPayload["items"][number];

function TaskDetailModal({
  task,
  open,
  onClose,
}: {
  task: TaskItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // sync local state whenever the selected task changes
  const stableId = task?.id;
  if (dueDate === "" && task?.dueDate) {
    setDueDate(task.dueDate.slice(0, 10));
  }

  if (!task) return null;

  async function handleSaveDueDate() {
    if (!stableId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/tasks/${stableId}`, {
        method: "PATCH",
        body: JSON.stringify({ due_date: dueDate || null }),
      });
      toast.success("Due date updated");
    } catch {
      toast.error("Failed to update due date");
    } finally {
      setSaving(false);
    }
  }

  const STATUS_PILL: Record<string, string> = {
    open: "bg-primary/10 text-primary",
    "in progress": "bg-amber-500/10 text-amber-600",
    completed: "bg-muted text-muted-foreground",
    closed: "bg-muted text-muted-foreground",
  };
  const pillCls = STATUS_PILL[(task.status ?? "").toLowerCase()] ?? "bg-muted text-muted-foreground";
  const dueDateChanged = dueDate !== (task.dueDate?.slice(0, 10) ?? "");

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) { setDueDate(""); onClose(); } }}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle className="text-base leading-snug pr-6">{task.title}</ModalTitle>
        </ModalHeader>

        <div className="flex flex-wrap gap-2">
          {task.status ? (
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", pillCls)}>
              {task.status}
            </span>
          ) : null}
          {task.priority ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
              {task.priority}
            </span>
          ) : null}
        </div>

        {task.description ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
        ) : null}

        <div className="grid gap-3">
          {task.assigneeName ? (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Assigned to</p>
                <p className="text-sm font-medium text-foreground">{task.assigneeName}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Due date</p>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
                {dueDateChanged ? (
                  <Button size="sm" variant="outline" onClick={handleSaveDueDate} disabled={saving} className="h-7 text-xs">
                    {saving ? <Loader2Icon className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {task.projectName ? (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <FolderIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Project</p>
                <p className="text-sm font-medium text-foreground">{task.projectName}</p>
              </div>
            </div>
          ) : null}

          {task.sourceTitle ? (
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <FileTextIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</p>
                <p className="text-sm font-medium text-foreground">{task.sourceTitle}</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <CalendarClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Created</p>
              <p className="text-sm font-medium text-foreground">{formatDateLabel(task.createdAt) ?? task.createdAt}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3">
          <Link
            href={task.href}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            onClick={() => { setDueDate(""); onClose(); }}
          >
            View full task <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <TaskFeedbackButtons
            taskId={task.id}
            projectId={task.projectId}
            taskSnapshot={{
              name: task.title,
              assignee: task.assigneeName,
              dueDate: task.dueDate,
              priority: task.priority ?? "medium",
              notes: task.description,
              projectId: task.projectId,
              source: task.sourceTitle,
            }}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

const STATUS_DOT: Record<string, string> = {
  open: "bg-primary",
  "in progress": "bg-amber-500",
  completed: "bg-muted-foreground",
  closed: "bg-muted-foreground/40",
};

function TaskCard({
  task,
  onClick,
}: {
  task: TaskItem;
  onClick: () => void;
}) {
  const dot = STATUS_DOT[(task.status ?? "").toLowerCase()] ?? "bg-muted-foreground/40";

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full cursor-pointer rounded-xl bg-background/60 p-3 text-left transition-colors hover:bg-background"
    >
      <div className="flex items-start gap-3">
        {/* icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <ListChecksIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          {/* title row */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
              {task.title}
            </p>
            {(task.status || task.priority) ? (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
                {[task.status, task.priority].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>

          {/* meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {task.assigneeName ? (
              <span className="flex items-center gap-1">
                <UserIcon className="h-3 w-3 shrink-0" />
                {task.assigneeName}
              </span>
            ) : null}
            {task.projectName ? (
              <span className="flex items-center gap-1">
                <FolderIcon className="h-3 w-3 shrink-0" />
                {task.projectName}
              </span>
            ) : null}
            {task.dueDate ? (
              <span className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3 shrink-0" />
                {formatDateLabel(task.dueDate)}
              </span>
            ) : null}
            {task.sourceTitle ? (
              <span className="flex items-center gap-1">
                <FileTextIcon className="h-3 w-3 shrink-0" />
                {task.sourceTitle}
              </span>
            ) : null}
            <span className="flex items-center gap-1 ml-auto">
              <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
              Created {formatDateLabel(task.createdAt) ?? task.createdAt}
            </span>
          </div>
        </div>
      </div>
    </Button>
  );
}

function TaskSummaryWidget({ widget }: { widget: TaskSummaryWidgetPayload }) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  return (
    <WidgetShell
      eyebrow="Verified task register"
      title={widget.title}
      icon={<CheckCircle2Icon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.totalCount} tasks</WidgetMeta>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{widget.subtitle}</span>
        <span className="font-medium text-foreground">{widget.dateLabel}</span>
      </div>

      {widget.items.length === 0 ? (
        <InfoAlert>
          <span>{widget.emptyState ?? "No task rows matched this request."}</span>
        </InfoAlert>
      ) : (
        <div className="flex flex-col gap-2">
          {widget.items.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
          ))}
        </div>
      )}

      <TaskDetailModal
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </WidgetShell>
  );
}

const EMAIL_HEADER_LINE = /^(Subject|Date|From|To|Sent|Cc|Bcc):\s/i;
const EMAIL_STANDALONE_ADDRESS = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

// Inline patterns that mark where boilerplate begins within a paragraph.
// When matched mid-paragraph, truncate there and stop processing further paragraphs.
const INLINE_BOILERPLATE_CUTOFFS: RegExp[] = [
  /[ \t]{4,}/,                                          // 4+ spaces = Outlook sig separator
  /\bthis email and any files\b/i,
  /\bif you are not the intended recipient\b/i,
  /\bthis message (is |contains |and any )/i,
  /\s[OMTFD]:\s*[+(]?\d/,                               // Phone lines: "O: (859)", "M: (513)"
  /\sMobile[:\s]+[\d(+]/i,                              // "Mobile 317.437.5361"
  /\s\|\s*(Email|Web|Phone|Tel|Mobile|Fax)[\s:]/i,      // "| Email:" delimiter blocks
];

function truncateAtBoilerplate(text: string): { content: string; truncated: boolean } {
  for (const pattern of INLINE_BOILERPLATE_CUTOFFS) {
    const idx = text.search(pattern);
    if (idx > 0) {
      return { content: text.slice(0, idx).replace(/[\s,.:]+$/, "").trim(), truncated: true };
    }
  }
  return { content: text, truncated: false };
}

function cleanEmailBodyPreview(value?: string | null): string[] {
  if (!value) return [];

  const normalized = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/\r\n/g, "\n")
    .replace(/\s+(From|Sent|To|Cc|Bcc|Subject):\s/gi, "\n$1: ")
    .replace(/\n{3,}/g, "\n\n");

  const result: string[] = [];

  for (const raw of normalized.split(/\n+/)) {
    const p = raw.replace(/[ \t]+/g, " ").trim();
    if (!p) continue;
    if (EMAIL_HEADER_LINE.test(p)) continue;
    if (/^Caution:\s*EXTERNAL EMAIL$/i.test(p)) continue;
    if (EMAIL_STANDALONE_ADDRESS.test(p)) continue;

    const { content, truncated } = truncateAtBoilerplate(p);
    if (content) result.push(content);
    if (truncated) break; // everything after a boilerplate marker is noise
    if (result.length >= 5) break;
  }

  return result;
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

function formatTimeLabel(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function EmailCardFeedback({
  itemId,
  subject,
}: {
  itemId: string;
  subject: string;
}) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  async function handleVote(signal: "up" | "down") {
    if (vote === signal) return;
    setVote(signal);
    const label = signal === "up" ? "Marked as relevant" : "Marked as not relevant — we'll filter these better";
    toast.success(label, { duration: 2500 });
    try {
      await apiFetch("/api/ai-assistant/feedback", {
        method: "POST",
        body: JSON.stringify({
          sessionId: `email-relevance-${itemId}`,
          messageId: itemId,
          feedback: signal,
          messageContent: subject,
        }),
      });
    } catch (error) {
      console.warn("[ai-assistant] Email relevance feedback failed.", error);
    }
  }

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="This email is relevant"
        onClick={() => void handleVote("up")}
        className={cn(
          "h-6 w-6 transition-colors",
          vote === "up"
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ThumbsUpIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="This email is not relevant"
        onClick={() => void handleVote("down")}
        className={cn(
          "h-6 w-6 transition-colors",
          vote === "down"
            ? "text-destructive"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ThumbsDownIcon className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function EmailCardActions({
  item,
  onSubmit,
}: {
  item: OutlookInboxSummaryWidgetPayload["items"][number];
  onSubmit: (message: string) => void;
}) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState("");

  function handleTagSubmit() {
    if (!tagValue.trim()) return;
    toast.success(`Tag "${tagValue.trim()}" noted — ask the assistant to apply it`);
    onSubmit(`Apply the tag "${tagValue.trim()}" to the email: "${item.subject}"`);
    setTagValue("");
    setTagOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2.5">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() => onSubmit(item.replyPrompt)}
      >
        <CornerUpLeftIcon className="h-3.5 w-3.5" />
        Reply
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() => onSubmit(item.draftPrompt)}
      >
        <SparklesIcon className="h-3.5 w-3.5 text-primary" />
        AI Draft
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() =>
          onSubmit(
            `Assign this email to the correct project. Email subject: "${item.subject}". ${item.projectIds.length > 0 ? `It may already be linked to project IDs: ${item.projectIds.join(", ")}.` : "It has no project assignment yet."}`,
          )
        }
      >
        <FolderIcon className="h-3.5 w-3.5" />
        Project
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 px-2 text-xs"
        onClick={() =>
          onSubmit(`Create a task based on this email: "${item.subject}". Recommended action: ${item.recommendedAction}`)
        }
      >
        <ListChecksIcon className="h-3.5 w-3.5" />
        Task
      </Button>

      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs">
            <TagIcon className="h-3.5 w-3.5" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Apply a tag</p>
          <div className="flex gap-1.5">
            <Input
              value={tagValue}
              onChange={(e) => setTagValue(e.target.value)}
              placeholder="e.g. urgent, legal..."
              className="h-7 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleTagSubmit(); }}
            />
            <Button size="sm" className="h-7 px-2 text-xs" onClick={handleTagSubmit}>
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OutlookInboxSummaryWidget({
  widget,
  onSubmit,
}: {
  widget: OutlookInboxSummaryWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(widget.items[0]?.id ?? null);

  if (widget.items.length === 0) {
    return (
      <div className="mt-3">
        <InfoAlert>
          <span>{widget.emptyState ?? "No Outlook emails matched this request."}</span>
        </InfoAlert>
      </div>
    );
  }

  const headline = widget.summary || widget.actionSummary;

  return (
    <section
      className="mt-3 overflow-hidden rounded-xl bg-muted/30"
      aria-label={widget.title}
    >
      {/* Header — eyebrow, title, executive overview */}
      <div className="px-4 pb-3 pt-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-primary">
          AI email assistant
        </p>
        <p className="mt-1.5 text-lg font-semibold text-foreground">
          {widget.title}
        </p>
        {headline ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {headline}
          </p>
        ) : null}
      </div>

      <div className="border-t border-border/60">
        {widget.items.map((item) => {
          const isOpen = openId === item.id;
          const initials = getInitials(item.fromName, item.fromEmail);
          const senderName = item.fromName || item.fromEmail || item.senders[0] || "Unknown";
          const timeLabel = formatTimeLabel(item.receivedAt);
          const bodyParagraphs = cleanEmailBodyPreview(item.bodyText ?? item.preview);

          return (
            <div
              key={item.id}
              className="border-b border-border/60 transition-colors last:border-b-0"
            >
              {/* Header row — always visible */}
              <div
                className="flex cursor-pointer items-start gap-3 px-4 py-3.5"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpenId(isOpen ? null : item.id); }}
                aria-expanded={isOpen}
              >
                {/* Avatar */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </div>

                {/* Main content */}
                <div className="min-w-0 flex-1">
                  {/* Subject + attachment */}
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.subject}
                    </p>
                    {item.hasAttachments ? (
                      <PaperclipIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-label="Has attachments" />
                    ) : null}
                  </div>

                  {/* Sender · time */}
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {senderName}
                    {item.messageCount > 1 ? (
                      <span className="text-muted-foreground/60">&nbsp;·&nbsp;{item.messageCount}</span>
                    ) : null}
                    {timeLabel ? <span>&nbsp;·&nbsp;{timeLabel}</span> : null}
                  </p>

                  {/* Preview — collapsed only */}
                  {!isOpen ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.preview ?? item.recommendedAction}
                    </p>
                  ) : null}
                </div>

                {/* Right affordances — draft signal + open */}
                <div
                  className="flex shrink-0 items-center gap-1 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={item.draftReady ? "Review prepared draft reply" : "Draft a reply with AI"}
                    onClick={() => {
                      setOpenId(item.id);
                      if (!item.draftReady) onSubmit(item.draftPrompt);
                    }}
                    className={cn(
                      "h-7 w-7",
                      item.draftReady
                        ? "text-primary hover:text-primary"
                        : "text-muted-foreground/40 hover:text-muted-foreground",
                    )}
                  >
                    <SquarePenIcon className="h-4 w-4" />
                  </Button>
                  {item.webLink ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Open email in Outlook"
                      className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
                      asChild
                    >
                      <Link href={item.webLink} target="_blank" rel="noreferrer">
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Expanded body */}
              {isOpen ? (
                <div className="px-4 pb-3.5">
                  {/* Prepared draft — only when a real draft exists */}
                  {item.draftReady && item.draftPreview ? (
                    <div className="ml-12 mb-2.5 rounded-md bg-primary/5 px-3 py-2.5">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                        <SquarePenIcon className="h-3.5 w-3.5" />
                        Drafted reply, ready to send
                      </p>
                      <p className="rounded-md bg-background/80 px-3 py-2 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                        {item.draftPreview}
                      </p>
                    </div>
                  ) : null}

                  {/* Email body */}
                  <div className="ml-12 space-y-2 rounded-md bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                    {bodyParagraphs.length > 0 ? (
                      bodyParagraphs.map((p, i) => (
                        <p key={i} className="whitespace-pre-wrap break-words">
                          {p}
                        </p>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No preview available.</p>
                    )}
                  </div>

                  {/* Action toolbar + relevance feedback */}
                  <div className="ml-12 mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <EmailCardActions item={item} onSubmit={onSubmit} />
                    <EmailCardFeedback itemId={item.id} subject={item.subject} />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Footer — into the full synced inbox */}
      <div className="border-t border-border/60 px-4 py-3 text-center">
        <Link
          href="/emails"
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          View all emails
        </Link>
      </div>
    </section>
  );
}

function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}


function normalizeCalendarInviteToolOutput(output: unknown): CalendarInviteWidgetPayload | null {
  const record = asRecord(output);
  const widget = asRecord(record.widget);
  if (widget.type === "calendar_invite") {
    return widget as CalendarInviteWidgetPayload;
  }

  if (typeof record.subject !== "string" && typeof record.message !== "string") return null;

  return {
    type: "calendar_invite",
    id: typeof record.id === "string" ? record.id : "outlook-calendar-invite",
    title: typeof record.title === "string" ? record.title : "Calendar invite",
    status: record.success === true ? "created" : record.action === "preview" ? "draft" : "blocked",
    organizerEmail: typeof record.organizerEmail === "string" ? record.organizerEmail : null,
    subject: typeof record.subject === "string" ? record.subject : "Project meeting",
    body: typeof record.body === "string" ? record.body : "",
    startDateTime: typeof record.startDateTime === "string" ? record.startDateTime : "",
    endDateTime: typeof record.endDateTime === "string" ? record.endDateTime : "",
    timeZone: typeof record.timeZone === "string" ? record.timeZone : "Eastern Standard Time",
    location: typeof record.location === "string" ? record.location : "Microsoft Teams",
    attendees: [],
    outlookEventId: typeof record.outlookEventId === "string" ? record.outlookEventId : null,
    outlookWebLink: typeof record.outlookWebLink === "string" ? record.outlookWebLink : null,
    teamsJoinUrl: typeof record.teamsJoinUrl === "string" ? record.teamsJoinUrl : null,
    adaptiveCard: asRecord(record.adaptiveCard),
    confirmPrompt:
      typeof record.confirmPrompt === "string"
        ? record.confirmPrompt
        : "Create this Outlook calendar invite with createOutlookCalendarInvite after confirmation.",
  };
}

function normalizeOutlookEmailDraftToolOutput(output: unknown): OutlookEmailDraftWidgetPayload | null {
  const record = asRecord(output);
  const widget = asRecord(record.widget);
  if (widget.type === "outlook_email_draft") {
    return widget as OutlookEmailDraftWidgetPayload;
  }

  if (typeof record.subject !== "string" && typeof record.message !== "string") return null;

  const toRecipients = Array.isArray(record.toRecipients)
    ? record.toRecipients.filter((item): item is OutlookEmailDraftWidgetPayload["toRecipients"][number] => {
        const recipient = asRecord(item);
        return typeof recipient.email === "string";
      })
    : [];
  const ccRecipients = Array.isArray(record.ccRecipients)
    ? record.ccRecipients.filter((item): item is OutlookEmailDraftWidgetPayload["toRecipients"][number] => {
        const recipient = asRecord(item);
        return typeof recipient.email === "string";
      })
    : [];
  const bccRecipients = Array.isArray(record.bccRecipients)
    ? record.bccRecipients.filter((item): item is OutlookEmailDraftWidgetPayload["toRecipients"][number] => {
        const recipient = asRecord(item);
        return typeof recipient.email === "string";
      })
    : [];
  const voiceProfile = asRecord(record.voiceProfile);

  return {
    type: "outlook_email_draft",
    id: typeof record.id === "string" ? record.id : "outlook-email-draft",
    title: typeof record.title === "string" ? record.title : "Outlook email draft",
    status: record.success === true ? "created" : record.action === "preview" ? "draft" : "blocked",
    mailboxUserId: typeof record.mailboxUserId === "string" ? record.mailboxUserId : null,
    mode: record.mode === "reply" ? "reply" : "new_message",
    subject: typeof record.subject === "string" ? record.subject : "Outlook email draft",
    body: typeof record.body === "string" ? record.body : "",
    toRecipients,
    ccRecipients,
    bccRecipients,
    replyToGraphMessageId: typeof record.replyToGraphMessageId === "string" ? record.replyToGraphMessageId : null,
    outlookDraftId: typeof record.outlookDraftId === "string" ? record.outlookDraftId : null,
    outlookWebLink: typeof record.outlookWebLink === "string" ? record.outlookWebLink : null,
    voiceProfile:
      typeof voiceProfile.path === "string" && typeof voiceProfile.version === "string"
        ? {
            path: voiceProfile.path,
            version: voiceProfile.version,
            summary: typeof voiceProfile.summary === "string" ? voiceProfile.summary : undefined,
          }
        : null,
    adaptiveCard: asRecord(record.adaptiveCard),
    confirmPrompt:
      typeof record.confirmPrompt === "string"
        ? record.confirmPrompt
        : "Create this Outlook email draft with draftOutlookEmail after confirmation.",
  };
}

function normalizeCreateContactToolOutput(output: unknown): CreateContactWidgetPayload | null {
  const record = asRecord(output);
  const widget = asRecord(record.widget);
  if (widget.type === "create_contact") {
    return widget as CreateContactWidgetPayload;
  }
  return null;
}

function normalizeGetRecentEmailsToolOutput(output: unknown): OutlookInboxSummaryWidgetPayload | null {
  const record = asRecord(output);
  if (record.error) return null;

  const threads = Array.isArray(record.threads) ? record.threads : [];
  const emails = Array.isArray(record.emails) ? record.emails : [];
  const source = threads.length > 0 ? threads : emails;
  if (source.length === 0 && !record.summary) return null;

  const appliedFilter = asRecord(record.appliedFilter);
  const mailbox =
    typeof appliedFilter.email === "string" ? appliedFilter.email : null;

  const items: OutlookInboxSummaryWidgetPayload["items"] = source.map((raw) => {
    const t = asRecord(raw);
    const isThread = "threadKey" in t;
    const id = isThread
      ? String(t.threadKey ?? t.latestId ?? "")
      : String(t.id ?? "");
    const subject = isThread
      ? String(t.latestSubject ?? "No subject")
      : String(t.subject ?? "No subject");
    const fromName = isThread
      ? (typeof t.latestFromName === "string" ? t.latestFromName : null)
      : (typeof t.fromName === "string" ? t.fromName : null);
    const fromEmail = isThread
      ? (typeof t.latestFromEmail === "string" ? t.latestFromEmail : null)
      : (typeof t.fromEmail === "string" ? t.fromEmail : null);
    const senders = Array.isArray(t.senders)
      ? (t.senders as string[])
      : fromEmail
        ? [fromEmail]
        : [];
    const recipients = Array.isArray(t.recipients)
      ? (t.recipients as string[])
      : Array.isArray(t.toList)
        ? (t.toList as string[])
        : [];
    const receivedAt = isThread
      ? (typeof t.latestReceivedAt === "string" ? t.latestReceivedAt : null)
      : (typeof t.receivedAt === "string" ? t.receivedAt : null);
    const preview = isThread
      ? (typeof t.latestPreview === "string" ? t.latestPreview : null)
      : (typeof t.preview === "string" ? t.preview : null);
    const bodyText = isThread ? null : (typeof t.bodyText === "string" ? t.bodyText : null);
    const webLink = isThread
      ? (Array.isArray(t.webLinks) ? (t.webLinks[0] as string | undefined) ?? null : null)
      : (typeof t.webLink === "string" ? t.webLink : null);
    const projectIds = Array.isArray(t.projectIds)
      ? (t.projectIds as number[])
      : typeof t.projectId === "number"
        ? [t.projectId]
        : [];
    const messageCount =
      typeof t.messageCount === "number" ? t.messageCount : 1;
    const hasAttachments = t.hasAttachments === true;
    const graphMessageId = isThread
      ? (typeof t.latestGraphMessageId === "string" ? t.latestGraphMessageId : null)
      : (typeof t.graphMessageId === "string" ? t.graphMessageId : null);
    const conversationId = isThread
      ? (typeof t.conversationId === "string" ? t.conversationId : null)
      : (typeof t.conversationId === "string" ? t.conversationId : null);

    return {
      id,
      graphMessageId,
      conversationId,
      subject,
      fromName,
      fromEmail,
      senders,
      recipients,
      receivedAt,
      messageCount,
      hasAttachments,
      attentionScore: 0,
      preview,
      bodyText,
      webLink,
      projectIds,
      recommendedAction: "Review",
      replyPrompt: `Reply to the email "${subject}" from ${fromName ?? fromEmail ?? "sender"}.`,
      draftPrompt: `Draft a follow-up email regarding "${subject}".`,
    };
  });

  const totalCount =
    typeof record.count === "number"
      ? record.count
      : items.length;
  const threadCount =
    typeof record.threadCount === "number" ? record.threadCount : null;
  const summary = typeof record.summary === "string" ? record.summary : "";
  const dataCutoffNote =
    typeof record.dataCutoffNote === "string" ? record.dataCutoffNote : null;

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return {
    type: "outlook_inbox_summary",
    id: `recent-emails-${Date.now()}`,
    title: "Recent Emails",
    subtitle: mailbox ?? "Your Outlook inbox",
    dateLabel,
    summary,
    dataCutoffNote,
    mailbox,
    totalCount,
    threadCount,
    actionSummary: `${items.length} email${items.length === 1 ? "" : "s"} shown`,
    items,
    emptyState: "No emails found for this date range.",
  };
}

function toMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeCommitmentDraftToolOutput(output: unknown): CommitmentDraftWidgetPayload | null {
  const record = asRecord(output);
  const widget = asRecord(record.widget);
  if (widget.type === "commitment_draft") {
    return widget as CommitmentDraftWidgetPayload;
  }

  const preview = asRecord(record.preview);
  const fields = asRecord(preview.fields);
  const table = String(preview.table ?? "").toLowerCase();
  if (record.action !== "preview" || (!table.includes("contract") && !table.includes("purchase"))) {
    return null;
  }

  const commitmentType: CommitmentDraftWidgetPayload["commitmentType"] =
    table.includes("purchase") ? "purchase_order" : "subcontract";
  const projectId = Number(fields.project_id);
  const contractNumber = String(fields.contract_number ?? "");
  const title = String(fields.title ?? "Untitled commitment");
  const vendorName =
    typeof fields.vendor_name_resolved === "string"
      ? fields.vendor_name_resolved
      : typeof fields.vendor_name === "string"
        ? fields.vendor_name
        : null;
  const vendorResolved = Boolean(fields.contract_company_id);
  const validation: CommitmentDraftWidgetPayload["validation"] = [
    {
      label: "Project",
      status: Number.isFinite(projectId) ? "pass" : "fail",
      message: Number.isFinite(projectId) ? `Project ${projectId}` : "Missing project.",
    },
    {
      label: "Vendor",
      status: vendorResolved ? "pass" : "fail",
      message: vendorResolved
        ? "Vendor is linked to a company record."
        : "Resolve the vendor before creating the commitment.",
    },
    {
      label: "Contract number",
      status: contractNumber ? "pass" : "warning",
      message: contractNumber || "Contract number will need to be assigned.",
    },
  ];

  return {
    type: "commitment_draft",
    id: "commitment-draft-preview",
    title: `${commitmentType === "subcontract" ? "Subcontract" : "Purchase order"} draft`,
    commitmentType,
    projectId: Number.isFinite(projectId) ? projectId : 0,
    contractNumber,
    vendorName,
    vendorResolved,
    fields: [
      { label: "Title", value: title, editable: true },
      { label: "Vendor", value: vendorName ?? "", editable: true },
      { label: "Status", value: String(fields.status ?? "Draft"), editable: true },
      { label: "Scope", value: String(fields.description ?? ""), editable: true, multiline: true },
      { label: "Start date", value: String(fields.start_date ?? ""), editable: true },
      {
        label: commitmentType === "purchase_order" ? "Delivery date" : "Estimated completion",
        value: String(fields.estimated_completion_date ?? fields.delivery_date ?? ""),
        editable: true,
      },
      {
        label: "Retainage %",
        value: fields.default_retainage_percent == null ? "" : String(fields.default_retainage_percent),
        editable: true,
      },
    ],
    validation,
    lineItems: [],
    totalAmount: 0,
    confirmPrompt:
      "Create this commitment with createCommitment. Use confirmed: false for any revised preview, and confirmed: true only after I explicitly confirm.",
  };
}

function normalizePrimeContractDraftToolOutput(
  output: unknown,
): PrimeContractDraftWidgetPayload | null {
  const record = asRecord(output);
  const widget = asRecord(record.widget);
  return widget.type === "prime_contract_draft"
    ? (widget as PrimeContractDraftWidgetPayload)
    : null;
}

function MeetingIntelligenceWidget({ widget }: { widget: MeetingIntelligenceWidgetPayload }) {
  return (
    <WidgetShell
      eyebrow="Meeting intelligence"
      title={widget.title}
      icon={<UsersRoundIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.meetingCount} meetings</WidgetMeta>}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{widget.subtitle}</span>
        <span className="font-medium text-foreground">{widget.dateLabel}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          ["Meetings", widget.meetingCount],
          ["Critical risks", widget.criticalRiskCount],
          ["Decisions", widget.decisionCount],
          ["Action items", widget.actionItemCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      {widget.topInsights.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">Top insights</div>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {widget.topInsights.slice(0, 4).map((insight) => (
              <li key={insight} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {widget.meetings.length === 0 ? (
        <InfoAlert>
          <span>{widget.emptyState ?? "No meeting rows matched this request."}</span>
        </InfoAlert>
      ) : (
        <div className="space-y-3">
          {widget.meetings.map((meeting) => (
            <div key={meeting.id} className="grid gap-2 rounded-xl bg-background/60 px-3 py-2.5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <Link
                  href={meeting.href}
                  className="min-w-0 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                >
                  {meeting.title}
                </Link>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  {[
                    meeting.criticalRisks.length > 0 ? `${meeting.criticalRisks.length} risks` : null,
                    meeting.decisions.length > 0 ? `${meeting.decisions.length} decisions` : null,
                  ].filter(Boolean).join(" / ")}
                </div>
              </div>
              {meeting.summary ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">{meeting.summary}</p>
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {meeting.projectName ? <span>Project: {meeting.projectName}</span> : null}
                {meeting.date ? <span>Date: {formatDateLabel(meeting.date) ?? meeting.date}</span> : null}
                {meeting.source ? <span>Source: {meeting.source}</span> : null}
                {meeting.actionItems.length > 0 ? <span>Actions: {meeting.actionItems.length}</span> : null}
              </div>
              {meeting.criticalRisks.length > 0 ? (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {meeting.criticalRisks[0]}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {widget.recommendedNextActions.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">Recommended next actions</div>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {widget.recommendedNextActions.slice(0, 3).map((action) => (
              <li key={action} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </WidgetShell>
  );
}

function OwnerSnapshotWidget({
  widget,
  onSubmit,
}: {
  widget: OwnerSnapshotWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Owner snapshot"
      title={widget.title}
      icon={<ActivityIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.status.replaceAll("_", " ")}</WidgetMeta>}
    >
      <div className="space-y-1">
        <p className="text-sm text-foreground">{widget.summary}</p>
        <p className="text-xs text-muted-foreground">
          {widget.projectName} - As of {formatDateLabel(widget.asOf) ?? widget.asOf}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {widget.healthSignals.slice(0, 6).map((signal) => (
          <div key={signal.label} className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{signal.label}</div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">{signal.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Money</div>
          <div className="mt-1 space-y-1">
            {Object.entries(widget.money).map(([label, value]) =>
              value ? (
                <div key={label} className="flex justify-between gap-3 rounded-lg bg-background/60 px-2.5 py-1.5 text-sm">
                  <span className="capitalize text-muted-foreground">{label.replace(/([A-Z])/g, " $1")}</span>
                  <span className="font-medium text-foreground">{value}</span>
                </div>
              ) : null,
            )}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">Owner actions</div>
          <div className="mt-1 space-y-1">
            {widget.ownerActions.slice(0, 4).map((action) => (
              <div key={action.id} className="rounded-lg bg-background/60 px-2.5 py-2 text-sm">
                <div className="font-medium text-foreground">{action.title}</div>
                {action.projectName || action.ownerName ? (
                  <div className="text-xs text-muted-foreground">
                    {[action.projectName, action.ownerName].filter(Boolean).join(" - ")}
                  </div>
                ) : null}
              </div>
            ))}
            {widget.ownerActions.length === 0 ? (
              <div className="rounded-lg bg-background/60 px-2.5 py-2 text-sm text-muted-foreground">No owner actions were returned.</div>
            ) : null}
          </div>
        </div>
      </div>

      {widget.dataGaps.length > 0 ? (
        <InfoAlert variant="warning">
          <span>{widget.dataGaps.slice(0, 3).join(" ")}</span>
        </InfoAlert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit(`Create a follow-up task from the owner snapshot for project ${widget.projectId}. Show a preview before writing.`)}
        >
          <CheckCircle2Icon className="h-4 w-4" />
          Create task
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSubmit(`Draft an owner update from this snapshot for ${widget.projectName}. Keep it source-backed and client-safe.`)}
        >
          <MailIcon className="h-4 w-4" />
          Draft update
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSubmit(`Ask the CFO to analyze the money impact for ${widget.projectName} using this snapshot.`)}
        >
          <TrendingUpIcon className="h-4 w-4" />
          Ask CFO
        </Button>
      </div>
    </WidgetShell>
  );
}

function OwnerActionQueueWidget({
  widget,
  onSubmit,
}: {
  widget: OwnerActionQueueWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Owner action queue"
      title={widget.title}
      icon={<ListChecksIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.totalCount} actions</WidgetMeta>}
    >
      <p className="text-sm text-muted-foreground">{widget.subtitle}</p>
      {widget.totalCount === 0 ? (
        <InfoAlert>
          <span>{widget.emptyState ?? "No owner actions matched this request."}</span>
        </InfoAlert>
      ) : (
        <div className="space-y-4">
          {widget.groups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {group.title}
              </div>
              <div className="space-y-1.5">
                {group.items.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 rounded-xl bg-background/60 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{item.title}</div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {item.projectName ? <span>{item.projectName}</span> : null}
                        {item.ownerName ? <span>Owner: {item.ownerName}</span> : null}
                        {item.dueDate ? <span>Due: {formatDateLabel(item.dueDate)}</span> : null}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => onSubmit(`Create or update the recommended action for this owner queue item. Show a preview first.\n\n${JSON.stringify(item, null, 2)}`)}
                    >
                      Preview
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

function MeetingInsightsWidget({
  widget,
  onSubmit,
}: {
  widget: MeetingInsightsWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Meeting insights"
      title={widget.title}
      icon={<UsersRoundIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.dateLabel}</WidgetMeta>}
    >
      <p className="text-sm text-muted-foreground">{widget.subtitle}</p>
      <div className="grid gap-2 sm:grid-cols-5">
        {[
          ["Meetings", widget.metrics.meetingCount],
          ["Decisions", widget.metrics.decisionCount],
          ["Actions", widget.metrics.actionItemCount],
          ["Risks", widget.metrics.riskCount],
          ["Questions", widget.metrics.unresolvedQuestionCount],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Decisions", widget.decisions],
          ["Open questions", widget.unresolvedQuestions],
          ["Risks", widget.risks],
          ["Suggested tasks", widget.suggestedTasks],
        ].map(([label, items]) => {
          const list = Array.isArray(items) ? items : [];
          return (
            <div key={label as string}>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label as string}</div>
              <div className="space-y-1">
                {list.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg bg-background/60 px-3 py-2 text-sm">
                    <div className="font-medium text-foreground">{item.title}</div>
                    {"detail" in item && item.detail ? (
                      <div className="text-xs text-muted-foreground">{item.detail}</div>
                    ) : null}
                  </div>
                ))}
                {list.length === 0 ? (
                  <div className="rounded-lg bg-background/60 px-3 py-2 text-sm text-muted-foreground">None returned.</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit(`Create task previews from the suggested meeting tasks in ${widget.title}.`)}
        >
          <CheckCircle2Icon className="h-4 w-4" />
          Create tasks
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSubmit(`Draft a concise meeting recap from ${widget.title} with source-backed decisions and follow-ups.`)}
        >
          <FileTextIcon className="h-4 w-4" />
          Draft recap
        </Button>
      </div>
    </WidgetShell>
  );
}

function RiskExposurePacketWidget({
  widget,
  onSubmit,
}: {
  widget: RiskExposurePacketWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Risk exposure"
      title={widget.title}
      icon={<AlertTriangleIcon className="h-4 w-4" />}
      actions={
        <WidgetMeta tone={widget.severity === "critical" ? "danger" : "muted"}>
          {widget.severity}
        </WidgetMeta>
      }
    >
      <p className="text-sm text-foreground">{widget.summary}</p>
      {widget.estimatedImpact ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Estimated impact: </span>
          <span className="font-semibold text-foreground">{widget.estimatedImpact}</span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(`Create a change event preview from this risk exposure packet.\n\n${JSON.stringify(widget, null, 2)}`)}>
          <ShieldCheckIcon className="h-4 w-4" />
          Create preview
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSubmit(`Draft an owner notice from this risk exposure packet. Keep it factual and source-backed.`)}>
          <MailIcon className="h-4 w-4" />
          Draft notice
        </Button>
      </div>
    </WidgetShell>
  );
}

function FinancialPulseWidget({
  widget,
  onSubmit,
}: {
  widget: FinancialPulseWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Financial pulse"
      title={widget.title}
      icon={<TrendingUpIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.scope}</WidgetMeta>}
    >
      <p className="text-sm text-muted-foreground">{widget.subtitle}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {widget.kpis.slice(0, 6).map((kpi) => (
          <div key={kpi.label} className="rounded-md bg-muted/40 px-3 py-2">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{kpi.label}</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{kpi.value}</div>
            {kpi.delta ? <div className="text-xs text-muted-foreground">{kpi.delta}</div> : null}
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" onClick={() => onSubmit(`Explain the financial pulse and recommend the next owner action.\n\n${JSON.stringify(widget, null, 2)}`)}>
        <SparklesIcon className="h-4 w-4" />
        Recommend action
      </Button>
    </WidgetShell>
  );
}

function CreativeDraftWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: CreativeDraftWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [draftBody, setDraftBody] = useState(widget.draftBody);
  const draft = [widget.draftTitle, draftBody].filter(Boolean).join("\n\n");

  return (
    <WidgetShell
      eyebrow="Creative draft"
      title={widget.title}
      icon={<SparklesIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.sourceCheck.status.replaceAll("_", " ")}</WidgetMeta>}
    >
      <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Source facts</div>
          <div className="divide-y divide-border/60">
            {widget.sourceFacts.slice(0, 5).map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className="py-2 text-sm">
                <div className="font-medium text-foreground">{fact.label}</div>
                <div className="text-xs text-muted-foreground">{fact.value}</div>
              </div>
            ))}
          </div>
        </div>
        <Textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} className="min-h-56 resize-y" />
      </div>
      {widget.bannedClaims.length > 0 ? (
        <InfoAlert variant="warning">
          <span>Unsupported claims to avoid: {widget.bannedClaims.slice(0, 3).join("; ")}</span>
        </InfoAlert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(`Source-check and improve this ${widget.format} draft:\n\n${draft}`)}>
          <FileTextIcon className="h-4 w-4" />
          Source-check
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(draft)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copyToClipboard(draft)}>
          <ClipboardIcon className="h-4 w-4" />
          Copy
        </Button>
      </div>
    </WidgetShell>
  );
}

function SourceEvidenceDrawerWidget({ widget }: { widget: SourceEvidenceDrawerWidgetPayload }) {
  return (
    <WidgetShell
      eyebrow="Evidence"
      title={widget.title}
      icon={<FileTextIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.sources.length} sources</WidgetMeta>}
    >
      <div className="grid gap-2">
        {widget.sources.slice(0, 8).map((source) => {
          const body = (
            <>
              <div className="truncate text-sm font-medium text-foreground">{source.title}</div>
              {source.snippet ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{source.snippet}</div> : null}
            </>
          );
          return source.href ? (
            <Link key={source.id} href={source.href} className="rounded-md border border-border px-3 py-2 hover:bg-muted/50">
              {body}
            </Link>
          ) : (
            <div key={source.id} className="rounded-md border border-border px-3 py-2">
              {body}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

function RecordWritePreviewWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: RecordWritePreviewWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [fields, setFields] = useState(widget.fields);
  const payload = {
    target: widget.target,
    fields: Object.fromEntries(fields.map((field) => [field.label, field.value])),
  };
  const prompt = `${widget.confirmPrompt}\n\n${JSON.stringify(payload, null, 2)}`;

  return (
    <WidgetShell
      eyebrow="Record write preview"
      title={widget.title}
      icon={<ShieldCheckIcon className="h-4 w-4" />}
      actions={
        <WidgetMeta tone={widget.safetyLevel === "high" ? "danger" : "muted"}>
          {widget.safetyLevel}
        </WidgetMeta>
      }
    >
      <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Target: </span>
        <span className="font-medium text-foreground">{widget.target.table} - {widget.target.recordType.replaceAll("_", " ")}</span>
      </div>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <label key={`${field.label}-${index}`} className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
            {field.multiline ? (
              <Textarea
                value={field.value}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = { ...field, value: event.target.value };
                  setFields(next);
                }}
                className="min-h-24 resize-y"
              />
            ) : (
              <Input
                value={field.value}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = { ...field, value: event.target.value };
                  setFields(next);
                }}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(prompt)}>
          <ShieldCheckIcon className="h-4 w-4" />
          {widget.actionLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(prompt)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
      </div>
    </WidgetShell>
  );
}

function CommitmentDraftWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: CommitmentDraftWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [fields, setFields] = useState(widget.fields);
  const lineItemsTotal = widget.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const total = widget.totalAmount || lineItemsTotal;
  const prompt = [
    widget.confirmPrompt,
    "",
    JSON.stringify(
      {
        projectId: widget.projectId,
        type: widget.commitmentType,
        contractNumber: widget.contractNumber,
        fields: Object.fromEntries(fields.map((field) => [field.label, field.value])),
        lineItems: widget.lineItems,
      },
      null,
      2,
    ),
  ].join("\n");

  return (
    <WidgetShell
      eyebrow="Commitment draft"
      title={widget.title}
      icon={<ShieldCheckIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.commitmentType.replaceAll("_", " ")}</WidgetMeta>}
    >
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Project</span>
          <span className="font-medium text-foreground">{widget.projectId}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Contract number</span>
          <span className="font-medium text-foreground">{widget.contractNumber}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">SOV total</span>
          <span className="font-medium text-foreground">{toMoney(total)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {fields.map((field, index) => (
          <label key={`${field.label}-${index}`} className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
            {field.multiline ? (
              <Textarea
                value={field.value}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = { ...field, value: event.target.value };
                  setFields(next);
                }}
                className="min-h-20 resize-y"
              />
            ) : (
              <Input
                value={field.value}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = { ...field, value: event.target.value };
                  setFields(next);
                }}
              />
            )}
          </label>
        ))}
      </div>

      {widget.lineItems.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[1fr_auto] gap-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Line item</span>
            <span>Amount</span>
          </div>
          <div className="divide-y divide-border">
            {widget.lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{item.description}</div>
                  {item.costCode ? (
                    <div className="text-xs text-muted-foreground">{item.costCode}</div>
                  ) : null}
                </div>
                <div className="font-medium text-foreground">{toMoney(item.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        {widget.validation.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-xs">
            <span
              className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                item.status === "pass"
                  ? "bg-emerald-600"
                  : item.status === "warning"
                    ? "bg-amber-600"
                    : "bg-destructive",
              )}
            />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{item.label}:</span> {item.message}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit(prompt)}
          disabled={widget.validation.some((item) => item.status === "fail")}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          Build final preview
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(prompt)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
      </div>
    </WidgetShell>
  );
}

function PrimeContractDraftWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: PrimeContractDraftWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [fields, setFields] = useState(widget.fields);
  const [lineItems, setLineItems] = useState(widget.lineItems);
  const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const locallyInvalidLineItems = lineItems.some(
    (item) =>
      !item.description.trim() ||
      !Number.isFinite(item.amount) ||
      item.amount < 0,
  );
  const editedStatus = fields
    .find((field) => field.label === "Status")
    ?.value.trim()
    .toLowerCase();
  const approvedZeroValue = editedStatus === "approved" && lineItemsTotal <= 0;
  const hasBlockingValidation =
    widget.validation.some(
      (item) => item.status === "fail" && item.label !== "Schedule of Values",
    ) || locallyInvalidLineItems || approvedZeroValue;
  const isReceipt = widget.status === "created" || widget.status === "partial";
  const sourceLocked =
    !isReceipt &&
    (widget.sovSource === "budget" || widget.sovSource === "workbook");
  const prompt = [
    widget.confirmPrompt,
    "",
    JSON.stringify(
      {
        projectId: widget.projectId,
        contractNumber: widget.contractNumber,
        sovSource: widget.sovSource,
        budgetLineIds:
          widget.sovSource === "budget" ? widget.sourceLineIds : undefined,
        workbookRows:
          widget.sovSource === "workbook" ? widget.workbookRows : undefined,
        workbookOmittedRows:
          widget.sovSource === "workbook"
            ? widget.workbookOmittedRows ?? 0
            : undefined,
        confirmed: true,
        fields: Object.fromEntries(fields.map((field) => [field.label, field.value])),
        lineItems,
        plannedWrites: {
          contractRows: widget.plannedWrites.contractRows,
          sovRows: lineItems.length,
        },
      },
      null,
      2,
    ),
  ].join("\n");

  return (
    <WidgetShell
      eyebrow={isReceipt ? "Prime Contract receipt" : "Prime Contract draft"}
      title={widget.title}
      icon={
        widget.status === "blocked" || widget.status === "partial" ? (
          <AlertTriangleIcon className="h-4 w-4" />
        ) : (
          <FileTextIcon className="h-4 w-4" />
        )
      }
      actions={<WidgetMeta>{widget.status}</WidgetMeta>}
    >
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Contract</span>
          <span className="font-medium text-foreground">{widget.contractNumber}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">SOV total</span>
          <span className="font-medium text-foreground">{toMoney(lineItemsTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Planned writes</span>
          <span className="font-medium text-foreground">
            {widget.plannedWrites.contractRows} contract + {lineItems.length} SOV
          </span>
        </div>
      </div>

      {widget.savedMarkups?.length ? (
        <div className="space-y-1 border-t border-border/60 pt-3 text-xs">
          <div className="font-medium text-foreground">Saved markups (not applied)</div>
          {widget.savedMarkups.map((markup) => (
            <div
              key={markup.id}
              className="flex items-center justify-between gap-3 text-muted-foreground"
            >
              <span className="capitalize">{markup.markupType.replaceAll("_", " ")}</span>
              <span>{markup.percentage}%{markup.compound ? " compound" : ""}</span>
            </div>
          ))}
        </div>
      ) : null}

      {isReceipt ? (
        <div className="space-y-2 text-sm">
          {fields.slice(0, 3).map((field) => (
            <div key={field.label} className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">{field.label}</span>
              <span className="text-right font-medium text-foreground">{field.value || "—"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <label key={`${field.label}-${index}`} className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
              {field.multiline ? (
                <Textarea
                  value={field.value}
                  onChange={(event) => {
                    const next = [...fields];
                    next[index] = { ...field, value: event.target.value };
                    setFields(next);
                  }}
                  className="min-h-20 resize-y"
                />
              ) : (
                <Input
                  value={field.value}
                  onChange={(event) => {
                    const next = [...fields];
                    next[index] = { ...field, value: event.target.value };
                    setFields(next);
                  }}
                />
              )}
            </label>
          ))}
        </div>
      )}

      {lineItems.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[auto_1fr_8rem] gap-3 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>#</span>
            <span>SOV line</span>
            <span>Amount</span>
          </div>
          <div className="divide-y divide-border">
            {lineItems.map((item, index) => (
              <div
                key={item.id}
                className="grid grid-cols-[auto_1fr_8rem] items-start gap-3 px-3 py-2 text-sm"
              >
                <span className="pt-2 text-muted-foreground">{index + 1}</span>
                <div className="min-w-0">
                  {isReceipt || sourceLocked ? (
                    <div className="pt-2 font-medium text-foreground">{item.description}</div>
                  ) : (
                    <Input
                      aria-label={`SOV line ${index + 1} description`}
                      value={item.description}
                      onChange={(event) => {
                        const next = [...lineItems];
                        next[index] = { ...item, description: event.target.value };
                        setLineItems(next);
                      }}
                    />
                  )}
                  {item.costCodeId ? (
                    <div className="text-xs text-muted-foreground">{item.costCodeId}</div>
                  ) : null}
                </div>
                {isReceipt || sourceLocked ? (
                  <span className="pt-2 text-right font-medium text-foreground">
                    {toMoney(item.amount)}
                  </span>
                ) : (
                  <MoneyField
                    aria-label={`SOV line ${index + 1} amount`}
                    label={`SOV line ${index + 1} amount`}
                    inline
                    value={Number.isFinite(item.amount) ? item.amount : undefined}
                    onChange={(value) => {
                      const next = [...lineItems];
                      next[index] = {
                        ...item,
                        amount: value ?? Number.NaN,
                      };
                      setLineItems(next);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isReceipt && (locallyInvalidLineItems || approvedZeroValue) ? (
        <p className="text-xs text-destructive">
          {approvedZeroValue
            ? "An approved Prime Contract requires a positive SOV value."
            : "Every SOV row needs a description and a non-negative amount."}
        </p>
      ) : null}

      <div className="space-y-1">
        {widget.validation.map((item) => (
          <div key={item.label} className="flex items-start gap-2 text-xs">
            <span
              className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                item.status === "pass"
                  ? "bg-emerald-600"
                  : item.status === "warning"
                    ? "bg-amber-600"
                    : "bg-destructive",
              )}
            />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{item.label}:</span> {item.message}
            </span>
          </div>
        ))}
      </div>

      {widget.failures?.length ? (
        <div className="space-y-1 border-t border-border/60 pt-3 text-xs text-destructive">
          {widget.failures.map((failure, index) => (
            <p key={`${failure.description}-${index}`}>
              {failure.lineNumber ? `Line ${failure.lineNumber}: ` : ""}
              {failure.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isReceipt && widget.recordHref ? (
          <Button size="sm" asChild>
            <Link href={widget.recordHref}>Open Prime Contract</Link>
          </Button>
        ) : widget.status === "draft" ? (
          <Button
            size="sm"
            onClick={() => onSubmit(prompt)}
            disabled={hasBlockingValidation}
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Request approval
          </Button>
        ) : null}
        {!isReceipt ? (
          <Button size="sm" variant="outline" onClick={() => onEditDraft(prompt)}>
            <SquarePenIcon className="h-4 w-4" />
            Edit in chat
          </Button>
        ) : null}
      </div>
    </WidgetShell>
  );
}

function CreateEventWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: CreateEventWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [title, setTitle] = useState(widget.defaultTitle);
  const [time, setTime] = useState(widget.defaultTime);
  const [location, setLocation] = useState(widget.defaultLocation);
  const [agenda, setAgenda] = useState(widget.defaultAgenda);
  const prompt = [
    "Prepare this project event for scheduling:",
    `Title: ${title}`,
    `Time: ${time}`,
    `Location: ${location}`,
    `Project ID: ${widget.projectId ?? "[resolve project first]"}`,
    "",
    `Agenda:\n${agenda}`,
  ].join("\n");

  return (
    <WidgetShell
      eyebrow="Calendar draft"
      title={widget.title}
      icon={<CalendarIcon className="h-4 w-4" />}
      actions={
        <div className="text-right leading-none">
          <div className="text-[11px] uppercase text-muted-foreground">{widget.dateLabel}</div>
          <div className="text-lg font-semibold text-foreground">{widget.dateNumber}</div>
        </div>
      }
    >
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Event title" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={time} onChange={(event) => setTime(event.target.value)} placeholder="Time" />
        <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" />
      </div>
      <Textarea value={agenda} onChange={(event) => setAgenda(event.target.value)} className="min-h-28 resize-y" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(prompt)}>
          <CalendarIcon className="h-4 w-4" />
          Stage event
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(prompt)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
      </div>
    </WidgetShell>
  );
}

function ChangeEventWorkflowWidget({
  widget,
  onSubmit,
  onEditDraft,
}: {
  widget: ChangeEventWorkflowWidgetPayload;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const { draft } = widget;
  const draftFields = [
    {
      label: "Project",
      value: draft.projectName ?? (draft.projectId ? `#${draft.projectId}` : "Missing"),
    },
    { label: "Title", value: draft.title ?? "Draft title pending" },
    { label: "Type", value: draft.cause ?? "Needs classification" },
    { label: "Scope", value: draft.scope },
    { label: "Cost", value: draft.costImpact ?? "TBD" },
    { label: "Schedule", value: draft.scheduleImpact ?? "TBD" },
  ];
  const hasEvidence = draft.relatedEvidence.length > 0;
  const summary = draft.narrative
    ? draft.readyForPreview
      ? "This is organized into a working Change Event draft with enough information for review."
      : "This is organized into a working Change Event draft."
    : draft.projectId
      ? "The project is set. Tell me what happened and the draft will be structured from there."
      : "Select the project first, then the draft can start.";
  const missingInformation = draft.missingRisks.slice(0, 3);
  const recommendations = draft.recommendedImpacts.slice(0, 3);

  return (
    <WidgetShell
      title="Change Event Draft"
      actions={<WidgetMeta>{draft.readyForPreview ? "Ready to review" : "Building"}</WidgetMeta>}
    >
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">What I’m doing</div>
        <p className="text-sm leading-6 text-foreground">{summary}</p>
      </div>

      {draft.narrative ? (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">What happened</div>
          <p className="line-clamp-3 text-sm leading-6 text-foreground">
            {draft.narrative}
          </p>
        </div>
      ) : null}

      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {draftFields.map((field) => (
          <div key={field.label} className="min-w-0">
            <div className="text-[11px] font-medium uppercase text-muted-foreground/80">
              {field.label}
            </div>
            <div className="truncate text-sm text-foreground">{field.value}</div>
          </div>
        ))}
      </div>

      {hasEvidence ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Related project records
          </div>
          <div className="divide-y divide-border/60">
            {draft.relatedEvidence.slice(0, 3).map((item) => (
              <div key={item.id} className="flex gap-3 py-2">
                <FileTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 space-y-0.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.sourceLabel}
                      {item.date ? ` - ${item.date.slice(0, 10)}` : ""}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {item.snippet}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : draft.narrative ? (
        <div className="text-sm text-muted-foreground">
          Related project records were checked. No confident match was found yet.
        </div>
      ) : null}

      {recommendations.length > 0 || missingInformation.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Recommendations
              </div>
              <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                {recommendations.map((recommendation) => (
                  <li key={recommendation}>- {recommendation}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {missingInformation.length > 0 ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Still unclear
              </div>
              <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
                {missingInformation.map((risk) => (
                  <li key={risk}>- {risk}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          One thing I still need
        </div>
        <p className="text-sm leading-6 text-foreground">{draft.nextQuestion}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onEditDraft(draft.nextQuestion)}>
          <SquarePenIcon className="h-4 w-4" />
          Add missing detail
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!draft.readyForPreview}
          onClick={() => onSubmit(draft.confirmPrompt)}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          Review before creating
        </Button>
      </div>
    </WidgetShell>
  );
}

function ProjectActionPreviewWidget({
  widget,
  selectedProjectId,
  onSubmit,
  onEditDraft,
}: {
  widget: ProjectActionPreviewWidgetPayload;
  selectedProjectId?: number | null;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const [fields, setFields] = useState(widget.fields);
  const projectId = selectedProjectId ?? widget.projectId ?? null;
  const payload = {
    actionType: widget.actionType,
    projectId: projectId ?? "[resolve project first]",
    fields: Object.fromEntries(fields.map((field) => [field.label, field.value])),
  };
  const prompt = `${widget.confirmPrompt}\n\n${JSON.stringify(payload, null, 2)}`;

  return (
    <WidgetShell
      eyebrow="Write preview"
      title={widget.title}
      icon={<ShieldCheckIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.actionType.replaceAll("_", " ")}</WidgetMeta>}
    >
      {!projectId ? (
        <InfoAlert variant="warning">
          <span>This needs a project before the write tool can run.</span>
        </InfoAlert>
      ) : null}
      <div className="space-y-2">
        {fields.map((field, index) => (
          <label key={`${field.label}-${index}`} className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">{field.label}</span>
            {field.multiline ? (
              <Textarea
                value={field.value}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = { ...field, value: event.target.value };
                  setFields(next);
                }}
                className="min-h-24 resize-y"
              />
            ) : (
              <Input
                value={field.value}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = { ...field, value: event.target.value };
                  setFields(next);
                }}
              />
            )}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSubmit(prompt)}>
          <ShieldCheckIcon className="h-4 w-4" />
          Build final preview
        </Button>
        <Button size="sm" variant="outline" onClick={() => onEditDraft(prompt)}>
          <SquarePenIcon className="h-4 w-4" />
          Edit in chat
        </Button>
      </div>
    </WidgetShell>
  );
}

function DecisionPacketWidget({
  widget,
  onSubmit,
}: {
  widget: DecisionPacketWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Decision support"
      title={widget.title}
      icon={<SparklesIcon className="h-4 w-4" />}
      actions={<WidgetMeta>Confidence: {widget.confidence}</WidgetMeta>}
    >
      <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
        {widget.recommendation}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {widget.impacts.map((impact) => (
          <div key={impact.label} className="rounded-md border border-border px-3 py-2">
            <div className="text-xs font-medium text-muted-foreground">{impact.label}</div>
            <div className="mt-1 text-sm text-foreground">{impact.value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-muted-foreground">Risks</div>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {widget.risks.map((risk) => (
              <li key={risk} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground">Next actions</div>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {widget.nextActions.map((action) => (
              <li key={action} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onSubmit("Pull the source evidence for this decision packet and recommend the safest next action.")}
      >
        <FileTextIcon className="h-4 w-4" />
        Pull evidence
      </Button>
    </WidgetShell>
  );
}

function FeatureRequestPacketWidget({
  widget,
  onSubmit,
}: {
  widget: FeatureRequestPacketWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  return (
    <WidgetShell
      eyebrow="Request packet"
      title={widget.title}
      icon={<GitBranchIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{widget.readinessLabel}</WidgetMeta>}
    >
      <div className="grid gap-2 text-sm text-foreground">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">{widget.status.replaceAll("_", " ")}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Acceptance criteria</span>
          <span className="font-medium">{widget.acceptanceCriteriaCount}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Open questions</span>
          <span className="font-medium">{widget.openQuestions.length}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
          <span className="text-muted-foreground">Linear</span>
          <span className="font-medium">{(widget.linearSyncStatus ?? "not_started").replaceAll("_", " ")}</span>
        </div>
      </div>
      {widget.openQuestions.length > 0 ? (
        <div>
          <div className="text-xs font-medium text-muted-foreground">Clarify next</div>
          <ul className="mt-1 space-y-1 text-sm text-foreground">
            {widget.openQuestions.slice(0, 3).map((question) => (
              <li key={question} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href={widget.detailHref}>
            <FileTextIcon className="h-4 w-4" />
            Open packet
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onSubmit(`Generate the implementation plan, Linear issue draft, Linear sub-issue drafts, and Claude Code handoff for feature request ${widget.requestId}.`)
          }
        >
          <GitBranchIcon className="h-4 w-4" />
          Build handoff
        </Button>
      </div>
    </WidgetShell>
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getSourceTitle(source: SourceItem, index: number): string {
  return source.metadata?.title || source.metadata?.source || `Source ${index + 1}`;
}

function getSourceHref(source: SourceItem): string | null {
  const metadata = asRecord(source.metadata);
  const projectId =
    typeof metadata.project_id === "number"
      ? metadata.project_id
      : Number(metadata.project_id);
  const recordId = String(
    metadata.meeting_id ?? metadata.metadata_id ?? metadata.file_id ?? metadata.id ?? source.document_id ?? "",
  ).trim();
  const type = String(metadata.doc_type ?? metadata.type ?? metadata.category ?? "").toLowerCase();

  // Governed Project Intelligence and Executive Report citations carry their
  // canonical route explicitly. Do not fall through to a document/meeting
  // resolver: these are durable artifacts, not raw source rows.
  const explicitUrl = typeof metadata.url === "string" ? metadata.url.trim() : "";
  // Revision-scoped evidence (for example FMDS tables and figures) persists a
  // canonical in-app route. Honor safe root-relative routes before attempting
  // record-type inference; otherwise valid evidence renders as a non-clickable
  // card even though its exact source route is already known.
  if (explicitUrl.startsWith("/") && !explicitUrl.startsWith("//")) {
    return explicitUrl;
  }
  // Prefer the IN-APP record page — "the actual file on the app" — over an
  // external link, so a meeting citation opens our transcript page (which reads
  // document_metadata by id) rather than the raw Fireflies recording.
  if (recordId) {
    if (type.includes("meeting")) return `/meetings/${recordId}`;
    if (Number.isFinite(projectId) && projectId) {
      if (type.includes("rfi")) return `/${projectId}/rfis/${recordId}`;
      if (type.includes("submittal")) return `/${projectId}/submittals/${recordId}`;
      if (type.includes("change event")) return `/${projectId}/change-events/${recordId}`;
    }
  }

  // Fall back to the external link when there is no in-app detail page for this
  // source type — e.g. an email opens its Outlook URL (there is no in-app email
  // detail page), and a document opens its stored URL.
  const externalLink = [metadata.url, metadata.fireflies_link]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value) => Boolean(value && /^https?:\/\//.test(value)));
  return externalLink ?? null;
}

export function AssistantSourceEvidenceWidget({
  sources,
}: {
  sources: unknown[];
}) {
  const validSources = (sources as SourceItem[]).filter(
    (source) => source.snippet || source.metadata?.title,
  );

  if (validSources.length === 0) return null;

  return (
    <WidgetShell
      eyebrow="Evidence"
      title="Source evidence used"
      icon={<FileTextIcon className="h-4 w-4" />}
      actions={<WidgetMeta>{validSources.length} sources</WidgetMeta>}
    >
      <div className="grid gap-2">
        {validSources.slice(0, 5).map((source, index) => {
          const title = getSourceTitle(source, index);
          const href = getSourceHref(source);
          const snippet = source.snippet ? `${source.snippet.slice(0, 180)}...` : null;
          const body = (
            <>
              <div className="truncate text-sm font-medium text-foreground">{title}</div>
              {snippet ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {snippet}
                </div>
              ) : null}
            </>
          );

          return href ? (
            <Link
              key={`${title}-${index}`}
              href={href}
              className="rounded-md border border-border px-3 py-2 hover:bg-muted/50"
            >
              {body}
            </Link>
          ) : (
            <div key={`${title}-${index}`} className="rounded-md border border-border px-3 py-2">
              {body}
            </div>
          );
        })}
      </div>
    </WidgetShell>
  );
}

function ProjectPickerWidget({
  widget,
  onSubmit,
}: {
  widget: ProjectPickerWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const actionLabel =
    widget.actionLabel ??
    (widget.intent === "owner_action_queue" ? "Generate queue" : "Use project");
  const visibleProjects = widget.projects.slice(0, 4);
  const dropdownProjects = widget.projects.slice(4);
  const selectProject = (project: ProjectPickerWidgetPayload["projects"][number]) => {
    setSelectedProjectId(String(project.projectId));
    onSubmit(project.prompt);
  };

  return (
    <WidgetShell
      title={widget.title}
      actions={<WidgetMeta>{visibleProjects.length} likely</WidgetMeta>}
    >
      <p className="text-sm leading-6 text-muted-foreground">{widget.subtitle}</p>

      {widget.projects.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Most active projects
            </div>
            <div className="divide-y divide-border/60">
              {visibleProjects.map((project) => (
                <Button
                  key={project.projectId}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start gap-3 px-0 py-2 text-left hover:bg-transparent"
                  onClick={() => selectProject(project)}
                  aria-label={`${actionLabel}: ${project.name}`}
                >
                  <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                      {[project.activityLabel, project.client, project.phase, project.state, project.contractValue]
                        .filter(Boolean)
                        .join(" - ") || `Project #${project.projectId}`}
                    </span>
                  </span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </div>
          {dropdownProjects.length > 0 ? (
            <div className="space-y-1.5">
              <Select
                value={selectedProjectId}
                onValueChange={(value) => {
                  const project = widget.projects.find(
                    (candidate) => String(candidate.projectId) === value,
                  );
                  if (project) selectProject(project);
                }}
              >
                <SelectTrigger size="sm" aria-label="Choose another project">
                  <SelectValue placeholder="Choose another project" />
                </SelectTrigger>
                <SelectContent>
                  {dropdownProjects.map((project) => (
                    <SelectItem
                      key={project.projectId}
                      value={String(project.projectId)}
                    >
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                You can also type the project name below.
              </p>
            </div>
          ) : null}
        </div>
      ) : widget.emptyState ? (
        <InfoAlert variant="info">{widget.emptyState}</InfoAlert>
      ) : null}
    </WidgetShell>
  );
}

const LANE_LABEL: Record<string, string> = {
  needsBrandon: "Needs Brandon",
  cashMargin: "Cash / Margin",
  customerOwner: "Customer / Owner",
  waitingOnOthers: "Waiting on Others",
  importantUpdates: "Important Update",
  schedule: "Schedule",
  risk: "Risk",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ExecutiveDailyBriefWidget({
  widget,
  onSubmit,
}: {
  widget: ExecutiveDailyBriefWidgetPayload;
  onSubmit: (message: string) => void;
}) {
  const { summary, financialPulse, topItems, sourceHealth } = widget;

  const lanes = [
    { key: "needsBrandon", label: "Needs Brandon", count: summary.needsBrandon, urgent: true },
    { key: "waitingOnOthers", label: "Waiting on Others", count: summary.waitingOnOthers, urgent: false },
    { key: "importantUpdates", label: "Important Updates", count: summary.importantUpdates, urgent: false },
  ];

  return (
    <WidgetShell
      eyebrow="Executive daily brief"
      title={`Morning Brief — ${widget.generatedAt}`}
      icon={<ActivityIcon className="h-4 w-4" />}
      actions={
        <Link
          href="/daily-briefs"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          History <ArrowRightIcon className="h-3 w-3" />
        </Link>
      }
    >
      {/* Lane summary pills */}
      <div className="flex flex-wrap gap-2">
        {lanes.map((lane) => (
          <div
            key={lane.key}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              lane.urgent && lane.count > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-background/80 text-muted-foreground",
            )}
          >
            <span className="text-sm font-semibold">{lane.count}</span>
            {lane.label}
          </div>
        ))}
      </div>

      {/* Top action items */}
      {topItems.length > 0 ? (
        <div className="space-y-2">
          {topItems.map((item, i) => (
            <div key={i} className="rounded-xl bg-background/60 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {LANE_LABEL[item.lane] ?? item.lane}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{item.project}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                  {item.nextMove ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Next: </span>
                      {item.nextMove}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-background/60 px-3 py-4 text-center text-sm text-muted-foreground">
          No items surfaced for today.
        </div>
      )}

      {/* Financial pulse */}
      {financialPulse ? (
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Financial pulse</div>
          <div className="space-y-1">
            {[
              ["Outstanding AR", formatCurrency(financialPulse.totalOutstandingAR)],
              ["Overdue AR", formatCurrency(financialPulse.totalOverdueAR)],
              ["Pending CO revenue", formatCurrency(financialPulse.pendingCORevenue)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-lg bg-background/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold text-foreground">{value}</span>
              </div>
            ))}
            {financialPulse.topOverdueProjects.length > 0 ? (
              <div className="mt-2 space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Top overdue</div>
                {financialPulse.topOverdueProjects.map((p) => (
                  <div key={p.project} className="flex items-center justify-between gap-4 rounded-lg bg-background/60 px-3 py-1.5 text-xs">
                    <span className="truncate text-muted-foreground">{p.project}</span>
                    <span className="shrink-0 font-medium text-destructive">{formatCurrency(p.overdue)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Source health */}
      {(sourceHealth.email ?? sourceHealth.teams ?? sourceHealth.meetings) ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/70">
          {[
            sourceHealth.email && `${sourceHealth.email.count} emails`,
            sourceHealth.teams && `${sourceHealth.teams.count} Teams`,
            sourceHealth.meetings && `${sourceHealth.meetings.count} meetings`,
          ]
            .filter(Boolean)
            .map((label) => (
              <span key={label as string}>{label as string}</span>
            ))}
          <span>· last 3 days</span>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit("Show me the full breakdown of items waiting on others from the brief.")}
        >
          <ListChecksIcon className="h-4 w-4" />
          Drill in
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSubmit("Draft a Teams message to the PM team with the key actions from the brief.")}
        >
          <SendIcon className="h-4 w-4" />
          Send to team
        </Button>
      </div>
    </WidgetShell>
  );
}

function normalizeDailyBriefToolOutput(output: unknown): ExecutiveDailyBriefWidgetPayload | null {
  const record = asRecord(output);
  if (record.success !== true) return null;

  const briefId = typeof record.briefId === "string" ? record.briefId : "daily-brief";
  const generatedAt = typeof record.generatedAt === "string" ? record.generatedAt : "";
  const summaryRaw = asRecord(record.summary);
  const summary = {
    needsBrandon: typeof summaryRaw.needsBrandon === "number" ? summaryRaw.needsBrandon : 0,
    waitingOnOthers: typeof summaryRaw.waitingOnOthers === "number" ? summaryRaw.waitingOnOthers : 0,
    importantUpdates: typeof summaryRaw.importantUpdates === "number" ? summaryRaw.importantUpdates : 0,
    topProjects: typeof summaryRaw.topProjects === "number" ? summaryRaw.topProjects : 0,
  };

  const fpRaw = asRecord(record.financialPulse);
  const financialPulse =
    record.financialPulse && typeof fpRaw.totalOutstandingAR === "number"
      ? {
          totalOutstandingAR: fpRaw.totalOutstandingAR as number,
          totalOverdueAR: typeof fpRaw.totalOverdueAR === "number" ? fpRaw.totalOverdueAR : 0,
          pendingCORevenue: typeof fpRaw.pendingCORevenue === "number" ? fpRaw.pendingCORevenue : 0,
          topOverdueProjects: Array.isArray(fpRaw.topOverdueProjects)
            ? (fpRaw.topOverdueProjects as Array<{ project: string; overdue: number }>).filter(
                (p) => typeof p.project === "string" && typeof p.overdue === "number",
              )
            : [],
        }
      : null;

  const topItems = Array.isArray(record.topItems)
    ? (record.topItems as Array<Record<string, unknown>>).map((item) => ({
        lane: typeof item.lane === "string" ? item.lane : "update",
        project: typeof item.project === "string" ? item.project : "",
        title: typeof item.title === "string" ? item.title : "",
        nextMove: typeof item.nextMove === "string" ? item.nextMove : "",
      }))
    : [];

  const shRaw = asRecord(record.sourceHealth);
  function toHealthEntry(raw: unknown) {
    const r = asRecord(raw);
    if (typeof r.count !== "number") return null;
    return {
      count: r.count,
      latest: typeof r.latest === "string" ? r.latest : "",
      status: typeof r.status === "string" ? r.status : "loaded",
    };
  }

  return {
    type: "executive_daily_brief",
    id: briefId,
    briefId,
    generatedAt,
    summary,
    financialPulse,
    topItems,
    sourceHealth: {
      email: toHealthEntry(shRaw.email),
      teams: toHealthEntry(shRaw.teams),
      meetings: toHealthEntry(shRaw.meetings),
    },
  };
}

type AssistantWidgetRendererComponent = (props: AssistantWidgetRendererProps) => ReactNode;

const assistantWidgetComponentRegistry: Record<AssistantWidgetPayload["type"], AssistantWidgetRendererComponent> = {
  draft_email: (props) =>
    props.widget.type === "draft_email" ? (
      <DraftEmailWidget widget={props.widget} onSubmit={props.onSubmit} onEditDraft={props.onEditDraft} />
    ) : null,
  outlook_email_draft: (props) =>
    props.widget.type === "outlook_email_draft" ? (
      <OutlookEmailDraftWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  calendar_invite: (props) =>
    props.widget.type === "calendar_invite" ? (
      <CalendarInviteWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  create_task: (props) =>
    props.widget.type === "create_task" ? (
      <CreateTaskWidget
        widget={props.widget}
        selectedProjectId={props.selectedProjectId}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  create_contact: (props) =>
    props.widget.type === "create_contact" ? (
      <CreateContactWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  task_summary: (props) =>
    props.widget.type === "task_summary" ? <TaskSummaryWidget widget={props.widget} /> : null,
  meeting_intelligence: (props) =>
    props.widget.type === "meeting_intelligence" ? <MeetingIntelligenceWidget widget={props.widget} /> : null,
  outlook_inbox_summary: (props) =>
    props.widget.type === "outlook_inbox_summary" ? (
      <OutlookInboxSummaryWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  project_picker: (props) =>
    props.widget.type === "project_picker" ? (
      <ProjectPickerWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  owner_snapshot: (props) =>
    props.widget.type === "owner_snapshot" ? (
      <OwnerSnapshotWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  owner_action_queue: (props) =>
    props.widget.type === "owner_action_queue" ? (
      <OwnerActionQueueWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  meeting_insights: (props) =>
    props.widget.type === "meeting_insights" ? (
      <MeetingInsightsWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  risk_exposure_packet: (props) =>
    props.widget.type === "risk_exposure_packet" ? (
      <RiskExposurePacketWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  financial_pulse: (props) =>
    props.widget.type === "financial_pulse" ? (
      <FinancialPulseWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  creative_draft: (props) =>
    props.widget.type === "creative_draft" ? (
      <CreativeDraftWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  source_evidence_drawer: (props) =>
    props.widget.type === "source_evidence_drawer" ? (
      <SourceEvidenceDrawerWidget widget={props.widget} />
    ) : null,
  record_write_preview: (props) =>
    props.widget.type === "record_write_preview" ? (
      <RecordWritePreviewWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  commitment_draft: (props) =>
    props.widget.type === "commitment_draft" ? (
      <CommitmentDraftWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  prime_contract_draft: (props) =>
    props.widget.type === "prime_contract_draft" ? (
      <PrimeContractDraftWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  create_event: (props) =>
    props.widget.type === "create_event" ? (
      <CreateEventWidget widget={props.widget} onSubmit={props.onSubmit} onEditDraft={props.onEditDraft} />
    ) : null,
  change_event_workflow: (props) =>
    props.widget.type === "change_event_workflow" ? (
      <ChangeEventWorkflowWidget
        widget={props.widget}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  project_action_preview: (props) =>
    props.widget.type === "project_action_preview" ? (
      <ProjectActionPreviewWidget
        widget={props.widget}
        selectedProjectId={props.selectedProjectId}
        onSubmit={props.onSubmit}
        onEditDraft={props.onEditDraft}
      />
    ) : null,
  decision_packet: (props) =>
    props.widget.type === "decision_packet" ? (
      <DecisionPacketWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  feature_request_packet: (props) =>
    props.widget.type === "feature_request_packet" ? (
      <FeatureRequestPacketWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
  executive_daily_brief: (props) =>
    props.widget.type === "executive_daily_brief" ? (
      <ExecutiveDailyBriefWidget widget={props.widget} onSubmit={props.onSubmit} />
    ) : null,
};

export const ASSISTANT_WIDGET_RENDERER_TYPES = Object.keys(
  assistantWidgetComponentRegistry,
) as AssistantWidgetPayload["type"][];

type AssistantToolPartForRegistry = {
  type: string;
  state: string;
  output?: unknown;
  approval?: unknown;
};

const assistantToolComponentRegistry: Record<string, (output: unknown) => AssistantWidgetPayload | null> = {
  createOutlookCalendarInvite: normalizeCalendarInviteToolOutput,
  draftOutlookEmail: normalizeOutlookEmailDraftToolOutput,
  getRecentEmails: normalizeGetRecentEmailsToolOutput,
  createCommitment: normalizeCommitmentDraftToolOutput,
  createPrimeContract: normalizePrimeContractDraftToolOutput,
  createContact: normalizeCreateContactToolOutput,
  generateExecutiveDailyBrief: normalizeDailyBriefToolOutput,
};

export function hasAssistantDynamicToolComponent(part: AssistantToolPartForRegistry): boolean {
  return Boolean(assistantToolComponentRegistry[part.type.replace(/^tool-/, "")]);
}

export function shouldRenderAssistantDynamicToolComponent(
  part: AssistantToolPartForRegistry,
): boolean {
  return (
    hasAssistantDynamicToolComponent(part) &&
    (!part.approval || part.state === "output-available")
  );
}

const TOOL_LOADING_LABELS: Record<string, string> = {
  generateExecutiveDailyBrief: "Generating daily brief…",
  getRecentEmails: "Loading emails…",
};

function ToolLoadingSkeleton({ toolName }: { toolName: string }) {
  const label = TOOL_LOADING_LABELS[toolName] ?? "Working…";
  return (
    <div className="w-full space-y-3 rounded-2xl bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <Loader2Icon className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function AssistantDynamicToolRenderer({
  part,
  selectedProjectId,
  onSubmit,
  onEditDraft,
}: {
  part: AssistantToolPartForRegistry;
  selectedProjectId?: number | null;
  onSubmit: (message: string) => void;
  onEditDraft: (message: string) => void;
}) {
  const toolName = part.type.replace(/^tool-/, "");
  const isRegistered = toolName in assistantToolComponentRegistry;

  if (part.state !== "output-available") {
    return isRegistered ? <ToolLoadingSkeleton toolName={toolName} /> : null;
  }

  const buildWidget = assistantToolComponentRegistry[toolName];
  if (!buildWidget) return null;
  const widget = buildWidget(part.output);
  if (!widget) return null;
  return (
    <AssistantWidgetRenderer
      widget={widget}
      selectedProjectId={selectedProjectId}
      onSubmit={onSubmit}
      onEditDraft={onEditDraft}
    />
  );
}

export function AssistantWidgetRenderer(props: AssistantWidgetRendererProps) {
  return assistantWidgetComponentRegistry[props.widget.type]?.(props) ?? null;
}
