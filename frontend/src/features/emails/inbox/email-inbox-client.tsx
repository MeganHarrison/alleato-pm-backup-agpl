"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import type {
  BrandonAssistantAction,
  BrandonAssistantPriority,
} from "@/lib/email-assistant/brandon-triage";
import { format } from "date-fns";
import type { BrandonReviewOutcome } from "@/lib/email-assistant/brandon-review";
import { EmailListPanel } from "./email-list-panel";
import { EmailReadingPane } from "./email-reading-pane";
import { cleanEmailBody } from "./email-body";
import { DetailField } from "@/components/ds/DetailField";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProjects, type Project } from "@/hooks/use-projects";

export type InboxTab = "brandon-queue" | "needs-assignment" | "all" | "has-attachments" | "reviewed";

export const EMAIL_INBOX_SPLIT_VIEW_CLASSNAME =
  "flex h-full min-h-0 flex-1 w-full overflow-hidden bg-background";

export interface ReviewedEmail {
  reviewId: string;
  id: number;
  subject: string;
  fromName: string | null;
  fromEmail: string | null;
  receivedAt: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  body: string | null;
  webLink: string | null;
  reviewOutcome: string;
  reviewerNote: string | null;
  draftBody: string | null;
  assistantReason: string | null;
  feedbackProvidedAt: string | null;
  projectAssignmentFeedback: {
    status: "correct" | "incorrect" | "unreviewed";
    correctedProjectId: number | null;
  };
  reviewedAt: string;
  starred: boolean;
  tags: string[];
  project: { id: number; name: string | null; projectNumber: string | null } | null;
}

export interface InboxAttachment {
  id: number;
  fileName: string;
  fileSize: number | null;
  contentType: string | null;
  graphAttachmentId: string;
  promotionStatus: string;
  attachmentType?: string | null;
}

export interface InboxEmail {
  id: number;
  graphMessageId: string;
  mailboxUserId: string;
  projectId: number | null;
  conversationId: string | null;
  subject: string;
  body: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toList: string[] | null;
  ccList: string[] | null;
  matchStatus: string;
  assignmentConfidence: number | null;
  receivedAt: string | null;
  hasAttachments: boolean | null;
  webLink: string | null;
  starred: boolean;
  tags: string[];
  assistantAction: BrandonAssistantAction;
  assistantPriority: BrandonAssistantPriority;
  assistantScore: number;
  assistantReason: string;
  assistantOwner: string;
  assistantRisk: string;
  assistantEvidence: string;
  project: { id: number; name: string | null; projectNumber: string | null } | null;
  attachments: InboxAttachment[];
}

function assistantString(
  value: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof value[key] === "string" ? value[key] : fallback;
}

function parseEmails(raw: unknown[]): InboxEmail[] {
  return raw.map((r: unknown) => {
    const e = r as Record<string, unknown>;
    const meta = (e.source_metadata as Record<string, unknown>) ?? {};
    const inbox = (meta._inbox as Record<string, unknown>) ?? {};
    const assistant = (meta._assistant as Record<string, unknown>) ?? {};
    const proj = e.projects as {
      id: number;
      name: string | null;
      project_number: string | null;
    } | null;
    const rawAttachments = (
      e.outlook_email_intake_attachments as unknown[]
    ) ?? [];

    return {
      id: e.id as number,
      graphMessageId: e.graph_message_id as string,
      mailboxUserId: e.mailbox_user_id as string,
      projectId: (e.project_id as number | null) ?? null,
      conversationId: (e.conversation_id as string | null) ?? null,
      subject: (e.subject as string) || "(no subject)",
      body: (e.body as string | null) ?? null,
      bodyHtml: (e.body_html as string | null) ?? null,
      bodyText: (e.body_text as string | null) ?? null,
      fromName: (e.from_name as string | null) ?? null,
      fromEmail: (e.from_email as string | null) ?? null,
      toList: (e.to_list as string[] | null) ?? null,
      ccList: (e.cc_list as string[] | null) ?? null,
      matchStatus: (e.match_status as string) ?? "unassigned",
      assignmentConfidence: (e.assignment_confidence as number | null) ?? null,
      receivedAt: (e.received_at as string | null) ?? null,
      hasAttachments: (e.has_attachments as boolean | null) ?? null,
      webLink: (e.web_link as string | null) ?? null,
      starred: (inbox.starred as boolean) ?? false,
      tags: (inbox.tags as string[]) ?? [],
      assistantAction:
        assistantString(assistant, "action", "ignore") as BrandonAssistantAction,
      assistantPriority:
        assistantString(assistant, "priority", "low") as BrandonAssistantPriority,
      assistantScore:
        typeof assistant.score === "number" ? assistant.score : 0,
      assistantReason: assistantString(
        assistant,
        "reason",
        "No assistant decision available.",
      ),
      assistantOwner: assistantString(assistant, "owner", "No action"),
      assistantRisk: assistantString(assistant, "risk", "Low"),
      assistantEvidence: assistantString(
        assistant,
        "evidence",
        "Subject and sender metadata only.",
      ),
      project: proj
        ? {
            id: proj.id,
            name: proj.name,
            projectNumber: proj.project_number,
          }
        : null,
      attachments: rawAttachments.map((a: unknown) => {
        const att = a as Record<string, unknown>;
        const attMeta =
          (att.source_metadata as Record<string, unknown>) ?? {};
        const attInbox = (attMeta._inbox as Record<string, unknown>) ?? {};
        return {
          id: att.id as number,
          fileName: att.file_name as string,
          fileSize: (att.file_size as number | null) ?? null,
          contentType: (att.content_type as string | null) ?? null,
          graphAttachmentId: att.graph_attachment_id as string,
          promotionStatus: (att.promotion_status as string) ?? "pending",
          attachmentType: (attInbox.type as string | null) ?? null,
        };
      }),
    };
  });
}

const REVIEW_OUTCOME_OPTIONS = [
  { value: "draft_copied", label: "Draft copied" },
  { value: "draft_edited", label: "Draft edited & copied" },
  { value: "delegated", label: "Delegated" },
  { value: "watched", label: "Watching" },
  { value: "skipped", label: "Skipped" },
  { value: "marked_no_action", label: "No action" },
];

const PROJECT_ASSIGNMENT_STATUS_OPTIONS = [
  { value: "unreviewed", label: "Not reviewed" },
  { value: "correct", label: "Correct" },
  { value: "incorrect", label: "Incorrect" },
] as const;

const UNASSIGNED_PROJECT_VALUE = "__unassigned__";

function cleanEditableText(value: string | null | undefined): string {
  return value ?? "";
}

function ReviewedReadingPane({
  reviewed,
  isSaving,
  projects,
  onSave,
}: {
  reviewed: ReviewedEmail | null;
  isSaving: boolean;
  projects: Project[];
  onSave: (
    reviewed: ReviewedEmail,
    updates: {
      reviewOutcome: string;
      reviewerNote: string | null;
      draftBody: string | null;
      projectAssignment: {
        status: "correct" | "incorrect" | "unreviewed";
        correctedProjectId: number | null;
      };
    },
  ) => Promise<void>;
}) {
  const [reviewOutcome, setReviewOutcome] = React.useState("");
  const [reviewerNote, setReviewerNote] = React.useState("");
  const [draftBody, setDraftBody] = React.useState("");
  const [projectAssignmentStatus, setProjectAssignmentStatus] =
    React.useState<"correct" | "incorrect" | "unreviewed">("unreviewed");
  const [correctedProjectValue, setCorrectedProjectValue] =
    React.useState(UNASSIGNED_PROJECT_VALUE);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReviewOutcome(reviewed?.reviewOutcome ?? "skipped");
    setReviewerNote(cleanEditableText(reviewed?.reviewerNote));
    setDraftBody(cleanEditableText(reviewed?.draftBody));
    setProjectAssignmentStatus(
      reviewed?.projectAssignmentFeedback.status ?? "unreviewed",
    );
    setCorrectedProjectValue(
      reviewed?.projectAssignmentFeedback.correctedProjectId
        ? String(reviewed.projectAssignmentFeedback.correctedProjectId)
        : reviewed?.project?.id
          ? String(reviewed.project.id)
          : UNASSIGNED_PROJECT_VALUE,
    );
    setSaveError(null);
  }, [
    reviewed?.reviewId,
    reviewed?.reviewOutcome,
    reviewed?.reviewerNote,
    reviewed?.draftBody,
    reviewed?.projectAssignmentFeedback.status,
    reviewed?.projectAssignmentFeedback.correctedProjectId,
    reviewed?.project?.id,
  ]);

  if (!reviewed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
        <p className="text-sm">Select a reviewed email to see details</p>
      </div>
    );
  }

  const reviewedDate = format(new Date(reviewed.reviewedAt), "MMM d, yyyy 'at' h:mm a");
  const receivedDate = reviewed.receivedAt
    ? format(new Date(reviewed.receivedAt), "MMM d, yyyy 'at' h:mm a")
    : null;
  const normalizedReviewerNote = reviewerNote.trim() || null;
  const normalizedDraftBody = draftBody.trim() || null;
  const correctedProjectId =
    correctedProjectValue === UNASSIGNED_PROJECT_VALUE
      ? null
      : Number.parseInt(correctedProjectValue, 10);
  const normalizedProjectAssignment = {
    status: projectAssignmentStatus,
    correctedProjectId:
      correctedProjectId !== null &&
      Number.isInteger(correctedProjectId) &&
      correctedProjectId > 0
        ? correctedProjectId
        : null,
  };
  const hasChanges =
    reviewOutcome !== reviewed.reviewOutcome ||
    normalizedReviewerNote !== (reviewed.reviewerNote ?? null) ||
    normalizedDraftBody !== (reviewed.draftBody ?? null) ||
    normalizedProjectAssignment.status !== reviewed.projectAssignmentFeedback.status ||
    normalizedProjectAssignment.correctedProjectId !==
      reviewed.projectAssignmentFeedback.correctedProjectId;
  const feedbackSavedLabel = reviewed.feedbackProvidedAt
    ? `Feedback saved ${format(new Date(reviewed.feedbackProvidedAt), "MMM d, h:mm a")}`
    : "No feedback saved yet";

  // Captured in a local so the non-null narrowing above survives inside the
  // nested handleSave function (TS drops prop narrowing across closures).
  const currentReviewed = reviewed;

  async function handleSave() {
    setSaveError(null);
    try {
      await onSave(currentReviewed, {
        reviewOutcome,
        reviewerNote: normalizedReviewerNote,
        draftBody: normalizedDraftBody,
        projectAssignment: normalizedProjectAssignment,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save the reviewed email feedback.";
      setSaveError(message);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/40 shrink-0">
        <p className="text-base font-semibold text-foreground leading-snug mb-3">
          {reviewed.subject}
        </p>

        <div className="flex flex-col gap-1 mb-3">
          <DetailField label="From">
            {reviewed.fromName && <span className="text-foreground">{reviewed.fromName} </span>}
            {reviewed.fromEmail && <span className="text-muted-foreground">&lt;{reviewed.fromEmail}&gt;</span>}
          </DetailField>
          {receivedDate && (
            <DetailField label="Received">{receivedDate}</DetailField>
          )}
          {reviewed.project && (
            <DetailField label="Project">
              <span className="text-primary">
                {reviewed.project.projectNumber
                  ? `${reviewed.project.projectNumber} — ${reviewed.project.name ?? ""}`
                  : (reviewed.project.name ?? `Project ${reviewed.project.id}`)}
              </span>
            </DetailField>
          )}
        </div>

        {/* Review outcome */}
        <div className="pt-3 border-t border-border/30 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{feedbackSavedLabel}</span>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!hasChanges || isSaving}
              onClick={() => {
                void handleSave();
              }}
            >
              {isSaving ? "Saving" : "Save"}
            </Button>
          </div>
          <DetailField label="Outcome">
            <Select value={reviewOutcome} onValueChange={setReviewOutcome}>
              <SelectTrigger className="h-8 max-w-xs">
                <SelectValue aria-label="Review outcome" />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_OUTCOME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DetailField>
          <DetailField label="Project">
            <div className="flex flex-col gap-2">
              <div className="text-sm text-foreground">
                {reviewed.project
                  ? reviewed.project.projectNumber
                    ? `${reviewed.project.projectNumber} - ${reviewed.project.name ?? ""}`
                    : reviewed.project.name ?? `Project ${reviewed.project.id}`
                  : "Unassigned"}
              </div>
              <Select
                value={projectAssignmentStatus}
                onValueChange={(value) =>
                  setProjectAssignmentStatus(
                    value as "correct" | "incorrect" | "unreviewed",
                  )
                }
              >
                <SelectTrigger className="h-8 max-w-xs">
                  <SelectValue aria-label="Project assignment feedback" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_ASSIGNMENT_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projectAssignmentStatus === "incorrect" && (
                <Select
                  value={correctedProjectValue}
                  onValueChange={setCorrectedProjectValue}
                >
                  <SelectTrigger className="h-8 max-w-md">
                    <SelectValue aria-label="Correct project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_PROJECT_VALUE}>
                      Unassigned
                    </SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.project_number
                          ? `${project.project_number} - ${project.name ?? "Unnamed Project"}`
                          : project.name ?? `Project ${project.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DetailField>
          <DetailField label="Feedback">
            <Textarea
              value={reviewerNote}
              onChange={(event) => setReviewerNote(event.target.value)}
              placeholder="Add what the assistant should learn from this email."
              className="min-h-20 resize-y"
            />
          </DetailField>
          <DetailField label="Draft">
            <Textarea
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="Paste or revise the draft response Brandon wanted."
              className="min-h-32 resize-y font-mono text-xs"
            />
          </DetailField>
          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
          {reviewed.assistantReason && (
            <p className="text-xs text-muted-foreground">
              AI suggested: {reviewed.assistantReason}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        {reviewed.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
            dangerouslySetInnerHTML={{ __html: reviewed.bodyHtml }}
          />
        ) : reviewed.bodyText ? (
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {cleanEmailBody(reviewed.bodyText)}
          </pre>
        ) : reviewed.body ? (
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {cleanEmailBody(reviewed.body)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">(No body content)</p>
        )}
      </div>

      {reviewed.webLink && (
        <div className="px-4 py-3 border-t border-border/40 shrink-0">
          <a
            href={reviewed.webLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Open in Outlook ↗
          </a>
        </div>
      )}
    </div>
  );
}

export function EmailInboxClient({
  initialTab = "brandon-queue",
}: {
  initialTab?: InboxTab;
} = {}) {
  const queryClient = useQueryClient();
  const { projects } = useProjects({ limit: 500 });
  const [activeTab, setActiveTab] = React.useState<InboxTab>(initialTab);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [draftReplyOpen, setDraftReplyOpen] = React.useState(false);

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const queryKey = ["email-inbox", activeTab, debouncedSearch];

  const { data: rawEmails = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ tab: activeTab });
      if (debouncedSearch) params.set("q", debouncedSearch);
      const data = await apiFetch<unknown[]>(`/api/email-inbox?${params}`);
      return data;
    },
  });

  const emails = React.useMemo(() => parseEmails(rawEmails), [rawEmails]);

  // Counts for tab badges
  const { data: needsCount = 0 } = useQuery({
    queryKey: ["email-inbox-count", "needs-assignment"],
    queryFn: async () => {
      const data = await apiFetch<unknown[]>("/api/email-inbox?tab=needs-assignment");
      return data.length;
    },
    refetchInterval: 60_000,
  });

  const { data: brandonQueueCount = 0 } = useQuery({
    queryKey: ["email-inbox-count", "brandon-queue"],
    queryFn: async () => {
      const data = await apiFetch<unknown[]>("/api/email-inbox?tab=brandon-queue");
      return data.length;
    },
    refetchInterval: 60_000,
  });

  const { data: reviewedEmails = [], isLoading: reviewedLoading } = useQuery({
    queryKey: ["email-inbox", "reviewed"],
    queryFn: () => apiFetch<ReviewedEmail[]>("/api/email-inbox/reviewed"),
    enabled: activeTab === "reviewed",
  });

  const selectedEmail = emails.find((e) => e.id === selectedId) ?? null;

  // Auto-select first email when list loads or tab changes
  React.useEffect(() => {
    if (emails.length > 0 && !selectedId) {
      setSelectedId(emails[0].id);
    } else if (emails.length > 0 && !emails.find((e) => e.id === selectedId)) {
      setSelectedId(emails[0].id);
    }
  }, [emails, selectedId]);

  // Close draft reply when switching emails
  React.useEffect(() => {
    setDraftReplyOpen(false);
  }, [selectedId]);

  // Keyboard navigation
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const idx = emails.findIndex((em) => em.id === selectedId);

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (idx < emails.length - 1) setSelectedId(emails[idx + 1].id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (idx > 0) setSelectedId(emails[idx - 1].id);
      } else if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        if (selectedEmail) setDraftReplyOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [emails, selectedId, selectedEmail]);

  const assignMutation = useMutation({
    mutationFn: ({
      emailId,
      projectId,
    }: {
      emailId: number;
      projectId: number | null;
    }) =>
      apiFetch(`/api/email-inbox/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      }),
    onSuccess: (_, { projectId }) => {
      toast.success(projectId ? "Assigned to project" : "Assignment cleared");
      void queryClient.invalidateQueries({ queryKey: ["email-inbox"] });
    },
    onError: () => toast.error("Failed to update assignment"),
  });

  const tagMutation = useMutation({
    mutationFn: ({ emailId, tags }: { emailId: number; tags: string[] }) =>
      apiFetch(`/api/email-inbox/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Failed to update tags"),
  });

  const starMutation = useMutation({
    mutationFn: ({
      emailId,
      starred,
    }: {
      emailId: number;
      starred: boolean;
    }) =>
      apiFetch(`/api/email-inbox/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast.error("Failed to update"),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      email,
      reviewOutcome,
      draftBody,
      reviewerNote,
    }: {
      email: InboxEmail;
      reviewOutcome: BrandonReviewOutcome;
      draftBody?: string | null;
      reviewerNote?: string | null;
    }) =>
      apiFetch(`/api/email-inbox/${email.id}/assistant-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantAction: email.assistantAction,
          assistantPriority: email.assistantPriority,
          assistantScore: email.assistantScore,
          reviewOutcome,
          draftBody,
          reviewerNote,
          assistantReason: email.assistantReason,
          assistantOwner: email.assistantOwner,
          assistantRisk: email.assistantRisk,
          assistantEvidence: email.assistantEvidence,
          sourceMetadata: {
            surface: "email-inbox",
            mailboxUserId: email.mailboxUserId,
          },
        }),
      }),
    onSuccess: (_, { email }) => {
      // Remove the reviewed email from the current list immediately
      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.filter((e: unknown) => {
          const row = e as Record<string, unknown>;
          return row.id !== email.id;
        });
      });
      // Advance selection to the next email in the list
      const idx = emails.findIndex((e) => e.id === email.id);
      const next = emails[idx + 1] ?? emails[idx - 1] ?? null;
      setSelectedId(next?.id ?? null);
      // Invalidate brandon-queue count badge and reviewed tab
      void queryClient.invalidateQueries({ queryKey: ["email-inbox-count", "brandon-queue"] });
      void queryClient.invalidateQueries({ queryKey: ["email-inbox", "reviewed"] });
    },
  });

  const reviewedUpdateMutation = useMutation({
    mutationFn: ({
      reviewed,
      reviewOutcome,
      reviewerNote,
      draftBody,
      projectAssignment,
    }: {
      reviewed: ReviewedEmail;
      reviewOutcome: string;
      reviewerNote: string | null;
      draftBody: string | null;
      projectAssignment: {
        status: "correct" | "incorrect" | "unreviewed";
        correctedProjectId: number | null;
      };
    }) =>
      apiFetch<Pick<
        ReviewedEmail,
        | "reviewId"
        | "id"
        | "reviewOutcome"
        | "reviewerNote"
        | "draftBody"
        | "feedbackProvidedAt"
        | "projectAssignmentFeedback"
      >>(
        "/api/email-inbox/reviewed",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewId: reviewed.reviewId,
            reviewOutcome,
            reviewerNote,
            draftBody,
            projectAssignment,
          }),
        },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<ReviewedEmail[]>(["email-inbox", "reviewed"], (old) => {
        if (!old) return old;
        return old.map((email) =>
          email.reviewId === updated.reviewId
            ? {
                ...email,
                reviewOutcome: updated.reviewOutcome,
                reviewerNote: updated.reviewerNote,
                draftBody: updated.draftBody,
                feedbackProvidedAt: updated.feedbackProvidedAt,
                projectAssignmentFeedback: updated.projectAssignmentFeedback,
              }
            : email,
        );
      });
      toast.success("Feedback saved");
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save reviewed email feedback.";
      toast.error(message);
    },
  });

  function handleTabChange(tab: InboxTab) {
    setActiveTab(tab);
    setSelectedId(null);
    setSearch("");
    setDraftReplyOpen(false);
  }

  const isReviewedTab = activeTab === "reviewed";
  const selectedReviewed = isReviewedTab
    ? reviewedEmails.find((r) => r.id === selectedId) ?? null
    : null;

  return (
    <div
      data-email-inbox-root
      className={EMAIL_INBOX_SPLIT_VIEW_CLASSNAME}
    >
      {/* Left panel — fixed width */}
      <div className="w-96 shrink-0 border-r border-border/50 flex flex-col overflow-hidden">
        <EmailListPanel
          emails={isReviewedTab ? [] : emails}
          reviewedEmails={isReviewedTab ? reviewedEmails : []}
          isLoading={isReviewedTab ? reviewedLoading : isLoading}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
          needsAssignmentCount={needsCount}
          brandonQueueCount={brandonQueueCount}
          reviewedCount={reviewedEmails.length}
        />
      </div>

      {/* Right panel — flexible */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {isReviewedTab ? (
          <ReviewedReadingPane
            reviewed={selectedReviewed}
            isSaving={reviewedUpdateMutation.isPending}
            projects={projects}
            onSave={async (reviewed, updates) => {
              await reviewedUpdateMutation.mutateAsync({
                reviewed,
                ...updates,
              });
            }}
          />
        ) : (
          <EmailReadingPane
            email={selectedEmail}
            draftReplyOpen={draftReplyOpen}
            onDraftReplyOpen={() => setDraftReplyOpen(true)}
            onDraftReplyClose={() => setDraftReplyOpen(false)}
            onAssignProject={(projectId) => {
              if (selectedEmail) {
                assignMutation.mutate({
                  emailId: selectedEmail.id,
                  projectId,
                });
              }
            }}
            onToggleStar={() => {
              if (selectedEmail) {
                starMutation.mutate({
                  emailId: selectedEmail.id,
                  starred: !selectedEmail.starred,
                });
              }
            }}
            onTagsChange={(tags) => {
              if (selectedEmail) {
                tagMutation.mutate({ emailId: selectedEmail.id, tags });
              }
            }}
            reviewSaving={reviewMutation.isPending}
            onRecordReview={async (reviewOutcome, draftBody, reviewerNote) => {
              if (!selectedEmail) return;
              await reviewMutation.mutateAsync({
                email: selectedEmail,
                reviewOutcome,
                draftBody,
                reviewerNote,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
