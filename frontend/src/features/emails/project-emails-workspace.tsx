"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  Cross2Icon,
  EnvelopeClosedIcon,
  FileTextIcon,
  MagnifyingGlassIcon,
  MixerHorizontalIcon,
  PaperPlaneIcon,
  Pencil1Icon,
  PlusIcon,
  ReloadIcon,
  StarFilledIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import {
  ArrowUpDown,
  Check,
  CheckCheck,
  Download,
  Flag,
  FolderOpen,
  Gauge,
  ImageIcon,
  ListTodo,
  Loader2,
  MessageSquareText,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Star,
  StarOff,
  User,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SplitPage, SplitPageFrame, useSplitPage } from "@/components/ui/split-page";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { cn } from "@/lib/utils";
import type { EmailSource, ProjectEmail } from "@/hooks/use-emails";
import { useProjects, type Project } from "@/hooks/use-projects";
import {
  buildEmailImportanceSnapshot,
  EmailImportanceFeedbackDialog,
} from "@/features/emails/email-importance-feedback-dialog";
import { hasMailboxDraft } from "@/features/emails/mailbox-workflow-tabs";
import {
  EMAIL_IMPORTANCE_REASON_LABELS,
  type EmailImportanceFeedbackState,
  type EmailImportanceSignal,
} from "@/lib/ai/email-importance-feedback-types";
import {
  EmailDetailSheet,
  projectEmailToDetailRecord,
} from "@/features/emails/email-detail-sheet";
import {
  buildEmailContentBlocks,
  latestReadableMessage,
  type EmailContentBlock,
} from "@/features/emails/email-thread";
import { toast } from "sonner";
import type { ProjectAssignmentReasonSignal } from "@/lib/email-assistant/brandon-review";
import {
  AiReviewPanel,
  AI_REVIEW_PANEL_ENABLED,
} from "@/features/emails/ai-review-panel";

const PdfDocument = dynamic(
  async () => {
    const mod = await import("react-pdf");
    mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod.Document;
  },
  { ssr: false },
);

const PdfPage = dynamic(
  async () => {
    const mod = await import("react-pdf");
    mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod.Page;
  },
  { ssr: false },
);

interface WorkspaceTab {
  label: string;
  href: string;
  isActive?: boolean;
  count?: number;
  compact?: boolean;
}

interface ProjectEmailsWorkspaceProps {
  emails: ProjectEmail[];
  isLoading: boolean;
  error?: Error | null;
  title?: string;
  description?: React.ReactNode;
  tabs: WorkspaceTab[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange: (status?: string) => void;
  /** Show the All / App / Outlook source toggle (unified Emails view). */
  showSourceFilter?: boolean;
  sourceFilter?: EmailSource;
  onSourceFilterChange?: (source: EmailSource) => void;
  /** Returns false for read-only (Outlook-synced) emails so Edit is hidden. */
  canEdit?: (email: ProjectEmail) => boolean;
  /** Hide the compose affordance on read-only (global / Outlook) surfaces. */
  canCompose?: boolean;
  /** Returns false for rows that cannot use the project email delete endpoint. */
  canDelete?: boolean | ((email: ProjectEmail) => boolean);
  /** Mail / Table / List switcher rendered in the list header. */
  viewSwitcher?: React.ReactNode;
  /** Filter control rendered next to search in the list header. */
  filterControl?: React.ReactNode;
  /** Active sort column id (matches the email table column ids). */
  sortBy?: string;
  /** Active sort direction. */
  sortDirection?: "asc" | "desc";
  /** Called when the user picks a different sort from the rail header. */
  onSortChange?: (sortBy: string, direction: "asc" | "desc") => void;
  /** Show Brandon-focused AI training controls in the right rail. */
  draftFeedbackMode?: boolean;
  /** Called after AI training feedback is saved so callers can refresh email rows. */
  onDraftFeedbackSaved?: () => void;
  importanceFeedbackByEmailId?: Record<string, EmailImportanceFeedbackState>;
  onImportanceRecorded?: (
    emailId: number,
    feedback: EmailImportanceFeedbackState,
  ) => Promise<void> | void;
  onImportanceCleared?: (emailId: number) => void;
  onCompose: () => void;
  onEdit: (email: ProjectEmail) => void;
  onDelete: (email: ProjectEmail) => void;
}

export const PROJECT_EMAILS_WORKSPACE_CLASSNAME =
  "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background";

interface EmailAttachmentRecord {
  id: number;
  emailId: number;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  contentType: string | null;
  createdAt: string | null;
  textLength: number;
  graphAttachmentId: string | null;
  checksumSha256: string | null;
  attachmentType: string | null;
  attachmentCategory: string | null;
  email: {
    id: number;
    subject: string;
    fromName: string | null;
    fromEmail: string | null;
    receivedAt: string | null;
    sentAt: string | null;
    createdAt: string | null;
  } | null;
}

const ATTACHMENT_TYPES = [
  "Drawings",
  "Submittal",
  "Invoice",
  "Pay App",
  "RFI",
  "Contract",
  "Proposal",
  "Specifications",
  "Photos",
  "Correspondence",
  "Report",
  "Other",
] as const;

// Sort options surfaced in the mail-view rail. Each maps to a (column id,
// direction) pair understood by the shared email table sort state. Newest-first
// is the default so the most recent message is always at the top.
const EMAIL_SORT_OPTIONS = [
  {
    value: "date_desc",
    label: "Newest first",
    sortBy: "sent_at",
    direction: "desc" as const,
  },
  {
    value: "date_asc",
    label: "Oldest first",
    sortBy: "sent_at",
    direction: "asc" as const,
  },
  {
    value: "sender_asc",
    label: "Sender A–Z",
    sortBy: "from_name",
    direction: "asc" as const,
  },
  {
    value: "subject_asc",
    label: "Subject A–Z",
    sortBy: "subject",
    direction: "asc" as const,
  },
];

function sortSelectionValue(
  sortBy?: string,
  direction?: "asc" | "desc",
): string {
  const match = EMAIL_SORT_OPTIONS.find(
    (option) => option.sortBy === sortBy && option.direction === direction,
  );
  return match?.value ?? "date_desc";
}

function SortPopover({
  sortBy,
  sortDirection,
  onSortChange,
}: {
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  onSortChange: (sortBy: string, direction: "asc" | "desc") => void;
}) {
  const [open, setOpen] = React.useState(false);
  const current = sortSelectionValue(sortBy, sortDirection);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sort emails"
          className="h-8 w-8 rounded-full text-muted-foreground shadow-none"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {EMAIL_SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onSortChange(option.sortBy, option.direction);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-sm transition-colors hover:bg-muted",
              current === option.value
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            {current === option.value && (
              <CheckIcon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className={cn(current !== option.value && "pl-[1.375rem]")}>
              {option.label}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function formatPaneTimestamp(value: string | null | undefined): string {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No timestamp";

  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} ${timeLabel}`;
}

function formatLongTimestamp(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMetaDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRecipientLine(recipients: string[] | null | undefined): string {
  if (!recipients || recipients.length === 0) return "No recipients";
  return recipients.join(", ");
}

function plainTextBody(email: ProjectEmail): string {
  const source =
    email.body_text?.trim() ||
    email.body?.trim() ||
    email.body_html?.trim() ||
    "";
  return latestReadableMessage(source);
}

function emailBodyBlocks(email: ProjectEmail): EmailContentBlock[] {
  const source =
    email.body_text?.trim() ||
    email.body?.trim() ||
    email.body_html?.trim() ||
    "";
  return buildEmailContentBlocks(source);
}

function suggestedTaskTitle(email: ProjectEmail): string {
  const subject = email.subject?.trim();
  if (!subject) return "Follow up on email";
  return subject.length > 160 ? `${subject.slice(0, 157)}...` : subject;
}

function suggestedTaskDescription(email: ProjectEmail): string {
  const sender = email.from_name || email.from_email || "Unknown sender";
  const recipients = formatRecipientLine(email.to_list);
  const timestamp = formatMetaDate(
    email.received_at || email.sent_at || email.created_at,
  );
  const body = plainTextBody(email).replace(/\s+/g, " ").trim();
  const excerpt = body.length > 1200 ? `${body.slice(0, 1197)}...` : body;

  return [
    `Follow up from email: ${email.subject || "Untitled email"}`,
    `From: ${sender}`,
    `To: ${recipients}`,
    `Date: ${timestamp}`,
    "",
    excerpt || "Add the task details here.",
  ].join("\n");
}

function projectLabel(
  project: ProjectEmail["project"] | null | undefined,
): string | null {
  if (!project) return null;
  if (project.project_number && project.name)
    return `${project.project_number} - ${project.name}`;
  return project.name || project.project_number || `Project ${project.id}`;
}

type EmailWorkspaceColumn = "left" | "right";

interface EmailWorkspaceLayoutPreference {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

const EMAIL_WORKSPACE_LAYOUT_STORAGE_KEY = "alleato-email-workspace-layout";
const EMAIL_WORKSPACE_LEFT_DEFAULT = 384;
const EMAIL_WORKSPACE_LEFT_MIN = 280;
const EMAIL_WORKSPACE_LEFT_MAX = 560;
const EMAIL_WORKSPACE_RIGHT_DEFAULT = 480;
const EMAIL_WORKSPACE_RIGHT_MIN = 360;
const EMAIL_WORKSPACE_RIGHT_MAX = 760;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadEmailWorkspaceLayout(): EmailWorkspaceLayoutPreference {
  const fallback: EmailWorkspaceLayoutPreference = {
    leftWidth: EMAIL_WORKSPACE_LEFT_DEFAULT,
    rightWidth: EMAIL_WORKSPACE_RIGHT_DEFAULT,
    leftCollapsed: false,
    rightCollapsed: false,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(
      EMAIL_WORKSPACE_LAYOUT_STORAGE_KEY,
    );
    if (!stored) return fallback;
    const parsed = JSON.parse(
      stored,
    ) as Partial<EmailWorkspaceLayoutPreference>;
    return {
      leftWidth:
        typeof parsed.leftWidth === "number"
          ? clampNumber(
              parsed.leftWidth,
              EMAIL_WORKSPACE_LEFT_MIN,
              EMAIL_WORKSPACE_LEFT_MAX,
            )
          : fallback.leftWidth,
      rightWidth:
        typeof parsed.rightWidth === "number"
          ? clampNumber(
              parsed.rightWidth,
              EMAIL_WORKSPACE_RIGHT_MIN,
              EMAIL_WORKSPACE_RIGHT_MAX,
            )
          : fallback.rightWidth,
      leftCollapsed:
        typeof parsed.leftCollapsed === "boolean"
          ? parsed.leftCollapsed
          : fallback.leftCollapsed,
      rightCollapsed:
        typeof parsed.rightCollapsed === "boolean"
          ? parsed.rightCollapsed
          : fallback.rightCollapsed,
    };
  } catch (error) {
    console.error("Could not load email workspace layout preference.", error);
    return fallback;
  }
}

function saveEmailWorkspaceLayout(preference: EmailWorkspaceLayoutPreference) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      EMAIL_WORKSPACE_LAYOUT_STORAGE_KEY,
      JSON.stringify(preference),
    );
  } catch (error) {
    console.error("Could not save email workspace layout preference.", error);
  }
}

function attachmentUrl(projectId: number, attachmentId: number): string {
  return `/api/projects/${projectId}/email-attachments/${attachmentId}/download`;
}

function patchAttachmentUrl(projectId: number, attachmentId: number): string {
  return `/api/projects/${projectId}/email-attachments/${attachmentId}`;
}

function previewUrl(projectId: number, attachmentId: number): string {
  return `${attachmentUrl(projectId, attachmentId)}?disposition=inline`;
}

function isImageAttachment(attachment: EmailAttachmentRecord): boolean {
  return (attachment.contentType?.toLowerCase() ?? "").startsWith("image/");
}

function isPdfAttachment(attachment: EmailAttachmentRecord): boolean {
  return (attachment.contentType?.toLowerCase() ?? "").includes("pdf");
}

function isPreviewableAttachment(attachment: EmailAttachmentRecord): boolean {
  return isImageAttachment(attachment) || isPdfAttachment(attachment);
}

function formatBytes(value: number | null): string {
  if (!value) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildAttachmentTypeOptions(
  attachments: EmailAttachmentRecord[],
): string[] {
  const defaults = [...ATTACHMENT_TYPES];
  const known = new Set(defaults.map((value) => value.toLowerCase()));
  const custom = attachments
    .map((attachment) => attachment.attachmentType?.trim() ?? "")
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .filter((value) => !known.has(value.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return [...defaults, ...custom];
}

function normalizeCustomOption(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function previewText(email: ProjectEmail): string {
  const body = plainTextBody(email).replace(/\s+/g, " ").trim();
  if (body.length > 120) return `${body.slice(0, 117)}...`;
  return body || "No message preview yet.";
}

function priorityDotClass(
  priority: ProjectEmail["assistant_priority"],
): string {
  switch (priority) {
    case "urgent":
      return "bg-red-500";
    case "high":
      return "bg-orange-500";
    case "normal":
      return "bg-blue-500";
    case "low":
      return "bg-slate-300";
    default:
      return "bg-muted-foreground/30";
  }
}

function priorityLabel(priority: ProjectEmail["assistant_priority"]): string {
  if (!priority) return "Priority not assigned";
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} priority`;
}

function reviewOutcomeLabel(outcome: string | null | undefined): string | null {
  if (!outcome) return null;
  return REVIEW_OUTCOME_LABELS[outcome as BrandonReviewOutcome] ?? outcome;
}

function reviewOutcomeClass(
  outcome: string | null | undefined,
): string {
  switch (outcome) {
    case "draft_copied":
    case "draft_edited":
      return "bg-emerald-50 text-emerald-700";
    case "delegated":
      return "bg-amber-50 text-amber-700";
    case "watched":
      return "bg-sky-50 text-sky-700";
    case "marked_no_action":
    case "skipped":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "EM";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function resolvePrimaryContact(email: ProjectEmail): {
  displayName: string;
  roleLabel: string;
  linkLabel: string | null;
} {
  const isReceived = email.status === "Received";
  const recipients = (email.to_list ?? [])
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  if (isReceived) {
    const displayName =
      email.from_name?.trim() || email.from_email?.trim() || "Project sender";

    return {
      displayName,
      roleLabel: "Sender",
      linkLabel: email.from_email?.trim() || null,
    };
  }

  const primaryRecipient = recipients[0] || "No recipient";

  return {
    displayName: primaryRecipient,
    roleLabel: "Recipient",
    linkLabel: primaryRecipient,
  };
}

export function buildContextItems(email: ProjectEmail): Array<{
  icon: React.ReactNode;
  label: string;
  value: string;
}> {
  return [
    {
      icon: <EnvelopeClosedIcon className="h-4 w-4" />,
      label: "From",
      value:
        email.from_email?.trim() || email.from_name?.trim() || "Not provided",
    },
    {
      icon: <PaperPlaneIcon className="h-4 w-4" />,
      label: "To",
      value: formatRecipientLine(email.to_list),
    },
    {
      icon: <FolderOpen className="h-4 w-4" />,
      label: "Project",
      value: projectLabel(email.project) ?? "No project assigned",
    },
    {
      icon: <ClockIcon className="h-4 w-4" />,
      label: email.status === "Received" ? "Received" : "Sent",
      value: formatLongTimestamp(
        email.received_at || email.sent_at || email.created_at,
      ),
    },
  ];
}

function InboxRow({
  email,
  isActive,
  onSelect,
  showCategory = false,
  draftFeedbackMode = false,
}: {
  email: ProjectEmail;
  isActive: boolean;
  onSelect: () => void;
  showCategory?: boolean;
  /**
   * The AI-training feedback queue. Strips the per-row status/AI-draft/category
   * pills and the priority dot down to sender · time / subject / preview, with a
   * single green "done" check once feedback has been given — the queue reads as a
   * calm list, not a wall of tags (matches the Feedback-inbox design handoff).
   */
  draftFeedbackMode?: boolean;
}) {
  const { onClose } = useSplitPage();
  const senderName = email.from_name || email.from_email || "Unknown sender";
  const hasDraft = hasMailboxDraft(email);
  const reviewOutcome = defaultReviewOutcome(email);
  const reviewLabel =
    email.assistant_review?.reviewId || hasDraft
      ? reviewOutcomeLabel(reviewOutcome)
      : "Pending review";
  const categoryLabel = defaultAssistantCategory(email);
  const isDone = Boolean(email.assistant_review?.feedbackProvidedAt);

  return (
    <Button
      type="button"
      onClick={() => {
        onSelect();
        onClose();
      }}
      variant="ghost"
      className={cn(
        "group h-auto min-w-0 w-full max-w-full justify-start overflow-hidden rounded-none border-l-2 px-3 py-2.5 text-left whitespace-normal transition-colors duration-200",
        isActive
          ? "border-primary bg-accent/60"
          : "border-transparent hover:bg-accent/50",
      )}
    >
      <div className="min-w-0 w-full max-w-full flex-1 overflow-hidden space-y-1">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div
            className={cn(
              "min-w-0 truncate text-[12px] font-medium leading-4",
              draftFeedbackMode && isDone
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            {senderName}
          </div>
          <div className="whitespace-nowrap text-[11px] font-medium tabular-nums text-foreground/60">
            {formatPaneTimestamp(
              email.received_at || email.sent_at || email.created_at,
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {draftFeedbackMode && isDone ? (
            <span
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-status-success text-primary-foreground"
              aria-label="Feedback given"
            >
              <Check className="h-2.5 w-2.5" />
            </span>
          ) : null}
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[12px] font-medium leading-4",
              draftFeedbackMode && isDone
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            {email.subject || "Untitled email"}
          </p>
          {draftFeedbackMode ? null : (
            <>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-3",
                  email.assistant_review?.reviewId || hasDraft
                    ? reviewOutcomeClass(reviewOutcome)
                    : "bg-muted text-muted-foreground",
                )}
              >
                {reviewLabel}
              </span>
              {hasDraft ? (
                <span className="shrink-0 rounded-full bg-status-success/10 px-1.5 py-0.5 text-[10px] font-medium leading-3 text-status-success">
                  AI draft
                </span>
              ) : null}
              {showCategory ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-3 text-muted-foreground">
                  {categoryLabel}
                </span>
              ) : null}
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {draftFeedbackMode ? null : (
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                priorityDotClass(email.assistant_priority),
              )}
              aria-label={priorityLabel(email.assistant_priority)}
              title={priorityLabel(email.assistant_priority)}
            />
          )}
          <p className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground">
            {previewText(email)}
          </p>
          {email.has_attachments ? (
            <FileTextIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : null}
        </div>
      </div>
    </Button>
  );
}

function ProjectAssignmentPopover({
  email,
  variant = "default",
}: {
  email: ProjectEmail;
  variant?: "default" | "toolbar";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { projects, isLoading } = useProjects({ enabled: open, limit: 250 });
  const currentLabel = projectLabel(email.project);

  async function handleSelect(nextProjectId: number) {
    if (nextProjectId === email.project_id) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      await apiFetch<ProjectEmail>(
        `/api/projects/${email.project_id}/emails/${email.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ project_id: nextProjectId }),
        },
      );
      setOpen(false);
      router.push(`/${nextProjectId}/emails`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "toolbar" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            className="h-auto max-w-full justify-start gap-1.5 rounded-md px-0 py-0 text-left text-[13px] font-normal text-foreground shadow-none hover:bg-transparent"
          >
            <span className="truncate">{currentLabel ?? "Assign project"}</span>
            {saving ? (
              <ReloadIcon className="h-3 w-3 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            className="h-8 max-w-full justify-start gap-1.5 rounded-full px-3 text-xs font-medium shadow-none"
          >
            {saving ? (
              <ReloadIcon className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="truncate">{currentLabel ?? "Assign project"}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading..." : "No projects found."}
            </CommandEmpty>
            <CommandGroup>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={`${project.project_number ?? ""} ${project.name ?? ""}`}
                  onSelect={() => handleSelect(project.id)}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      project.id === email.project_id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">
                    {project.project_number
                      ? `${project.project_number} - ${project.name ?? `Project ${project.id}`}`
                      : (project.name ?? `Project ${project.id}`)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AttachmentTypePopover({
  attachment,
  projectId,
  availableTypes,
  onUpdated,
}: {
  attachment: EmailAttachmentRecord;
  projectId: number;
  availableTypes: string[];
  onUpdated: (attachmentId: number, nextType: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const trimmedSearch = normalizeCustomOption(search);
  const hasExactMatch = availableTypes.some(
    (type) => type.toLowerCase() === trimmedSearch.toLowerCase(),
  );

  const handleChange = async (value: string | null) => {
    const next = value === "__clear__" ? null : value;
    setSaving(true);
    try {
      await apiFetch(patchAttachmentUrl(projectId, attachment.id), {
        method: "PATCH",
        body: JSON.stringify({ attachmentType: next }),
      });
      onUpdated(attachment.id, next);
      setOpen(false);
      setSearch("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving}
          className="h-7 justify-between gap-1 rounded-full px-2.5 text-[11px] font-medium shadow-none"
        >
          <span
            className={cn(
              "truncate",
              attachment.attachmentType
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {attachment.attachmentType ?? "Set type"}
          </span>
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or create type..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No matching types.</CommandEmpty>
            <CommandGroup>
              {attachment.attachmentType ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => void handleChange("__clear__")}
                  className="text-muted-foreground"
                >
                  Clear type
                </CommandItem>
              ) : null}
              {trimmedSearch && !hasExactMatch ? (
                <CommandItem
                  value={`create ${trimmedSearch}`}
                  onSelect={() => void handleChange(trimmedSearch)}
                >
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Create "{trimmedSearch}"
                </CommandItem>
              ) : null}
              {availableTypes.map((type) => (
                <CommandItem
                  key={type}
                  value={type}
                  onSelect={() => void handleChange(type)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      attachment.attachmentType === type
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AttachmentPreviewModal({
  attachment,
  projectId,
  open,
  onOpenChange,
}: {
  attachment: EmailAttachmentRecord | null;
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        size="xl"
        className="h-full max-h-screen max-w-5xl overflow-hidden p-0"
      >
        <ModalHeader className="border-b border-border/70 px-6 py-4">
          <ModalTitle>
            {attachment?.fileName ?? "Attachment preview"}
          </ModalTitle>
          <ModalDescription>
            {attachment?.contentType || "Attachment preview"}
          </ModalDescription>
        </ModalHeader>
        {attachment ? (
          <div className="h-full min-h-0 bg-muted/20">
            {isImageAttachment(attachment) ? (
              <div className="flex h-full items-center justify-center overflow-auto p-6">
                <img
                  src={previewUrl(projectId, attachment.id)}
                  alt={attachment.fileName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : isPdfAttachment(attachment) ? (
              <div className="h-full overflow-auto p-6">
                <PdfDocument
                  file={previewUrl(projectId, attachment.id)}
                  loading={
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading preview...
                    </div>
                  }
                  error={
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Preview failed to load.
                    </div>
                  }
                  className="mx-auto flex w-fit flex-col gap-4"
                >
                  <PdfPage
                    pageNumber={1}
                    width={900}
                    renderAnnotationLayer
                    renderTextLayer
                    className="overflow-hidden rounded-md bg-background shadow-sm"
                  />
                </PdfDocument>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No preview is available for this attachment type.
              </div>
            )}
          </div>
        ) : null}
      </ModalContent>
    </Modal>
  );
}

interface EmailReadingPanelProps {
  email: ProjectEmail | null;
  canCompose?: boolean;
  canEditEmail?: boolean;
  canDelete?: boolean;
  canProjectEmailActions?: boolean;
  onCompose?: () => void;
  onEdit?: (email: ProjectEmail) => void;
  onDelete?: (email: ProjectEmail) => void;
  showDetailsButton?: boolean;
  onOpenDetails?: () => void;
  importanceFeedback?: EmailImportanceFeedbackState | null;
  onImportanceRecorded?: (
    emailId: number,
    feedback: EmailImportanceFeedbackState,
  ) => Promise<void> | void;
  onImportanceCleared?: (emailId: number) => void;
  className?: string;
}

interface EmailActionControlsProps {
  onSummarize?: () => void;
  importanceFeedback?: EmailImportanceFeedbackState | null;
  onImportanceIntent: (signal: EmailImportanceSignal) => void;
  onImportanceClear?: () => void;
  isClearingImportance?: boolean;
  onCreateTask?: () => void;
  className?: string;
  orientation?: "row" | "column";
  showImportanceControls?: boolean;
  showTaskActions?: boolean;
}

function importanceSignalLabel(signal: EmailImportanceSignal): string {
  return signal === "important" ? "Marked important" : "Marked not important";
}

function oppositeImportanceSignal(
  signal: EmailImportanceSignal,
): EmailImportanceSignal {
  return signal === "important" ? "not_important" : "important";
}

function EmailActionControls({
  onSummarize,
  importanceFeedback,
  onImportanceIntent,
  onImportanceClear,
  isClearingImportance = false,
  onCreateTask,
  className,
  orientation = "row",
  showImportanceControls = true,
  showTaskActions = true,
}: EmailActionControlsProps) {
  const oppositeSignal = importanceFeedback
    ? oppositeImportanceSignal(importanceFeedback.signal)
    : null;
  const reasonLabel = importanceFeedback?.reasonCategory
    ? EMAIL_IMPORTANCE_REASON_LABELS[importanceFeedback.reasonCategory]
    : null;

  return (
    <div
      className={cn(
        orientation === "column"
          ? "flex flex-col items-stretch gap-1"
          : "flex flex-wrap items-center gap-1.5",
        className,
      )}
    >
      {showTaskActions && onSummarize ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSummarize}
          className={cn(
            "h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            orientation === "column" && "justify-start",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Summarize
        </Button>
      ) : null}

      {showImportanceControls && importanceFeedback ? (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs",
            orientation === "column" && "items-start",
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-foreground">
            {importanceFeedback.signal === "important" ? (
              <Star className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <StarOff className="h-3.5 w-3.5 shrink-0" />
            )}
            {importanceSignalLabel(importanceFeedback.signal)}
          </span>
          {reasonLabel ? (
            <span className="text-muted-foreground">{reasonLabel}</span>
          ) : null}
          {importanceFeedback.reason ? (
            <span className="min-w-0 truncate text-muted-foreground">
              {importanceFeedback.reason}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onImportanceIntent(importanceFeedback.signal)}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Edit
          </Button>
          {oppositeSignal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onImportanceIntent(oppositeSignal)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {oppositeSignal === "important" ? "Mark important" : "Not important"}
            </Button>
          ) : null}
          {onImportanceClear ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onImportanceClear}
              disabled={isClearingImportance}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {isClearingImportance ? "Reverting..." : "Revert"}
            </Button>
          ) : null}
        </div>
      ) : showImportanceControls ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onImportanceIntent("important")}
            className={cn(
              "h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground",
              orientation === "column" && "justify-start",
            )}
          >
            <Star className="h-3.5 w-3.5" />
            Mark important
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onImportanceIntent("not_important")}
            className={cn(
              "h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground",
              orientation === "column" && "justify-start",
            )}
          >
            <StarOff className="h-3.5 w-3.5" />
            Not important
          </Button>
        </>
      ) : null}

      {showTaskActions && onCreateTask ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCreateTask}
          className={cn(
            "h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground",
            orientation === "column" && "justify-start",
          )}
        >
          <ListTodo className="h-3.5 w-3.5" />
          Create task
        </Button>
      ) : null}
    </div>
  );
}

export function EmailReadingPanel({
  email,
  canCompose = true,
  canEditEmail = false,
  canDelete = true,
  canProjectEmailActions = true,
  onCompose,
  onEdit,
  onDelete,
  showDetailsButton = false,
  onOpenDetails,
  importanceFeedback = null,
  onImportanceRecorded,
  onImportanceCleared,
  className,
}: EmailReadingPanelProps) {
  const router = useRouter();
  const [importanceDialogOpen, setImportanceDialogOpen] = React.useState(false);
  const [importanceSignal, setImportanceSignal] = React.useState<
    EmailImportanceSignal | null
  >(null);
  const [isClearingImportance, setIsClearingImportance] = React.useState(false);
  const [createTaskOpen, setCreateTaskOpen] = React.useState(false);
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskDescription, setTaskDescription] = React.useState("");
  const [taskPriority, setTaskPriority] = React.useState<
    "high" | "medium" | "low"
  >("medium");
  const [taskStatus, setTaskStatus] = React.useState<
    "open" | "in_progress" | "blocked"
  >("open");
  const [taskDueDate, setTaskDueDate] = React.useState("");
  const [isCreatingTask, setIsCreatingTask] = React.useState(false);
  const [previewAttachment, setPreviewAttachment] =
    React.useState<EmailAttachmentRecord | null>(null);
  const [attachmentOverrides, setAttachmentOverrides] = React.useState<
    Record<number, string | null>
  >({});
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [desktopActionsSlot, setDesktopActionsSlot] =
    React.useState<HTMLElement | null>(null);

  const selectedBody = React.useMemo(
    () => (email ? plainTextBody(email) : ""),
    [email],
  );
  const selectedBodyBlocks = React.useMemo(
    () => (email ? emailBodyBlocks(email) : []),
    [email],
  );
  const { data: projectAttachments = [] } = useQuery<EmailAttachmentRecord[]>({
    queryKey: ["email-attachments", email?.project_id],
    queryFn: ({ signal }) =>
      apiFetch<EmailAttachmentRecord[]>(
        `/api/projects/${email?.project_id}/email-attachments`,
        { signal },
      ),
    enabled: Boolean(email?.project_id && canProjectEmailActions),
  });
  const selectedAttachments = React.useMemo(
    () =>
      projectAttachments
        .filter((attachment) => attachment.emailId === email?.id)
        .map((attachment) => ({
          ...attachment,
          attachmentType:
            attachmentOverrides[attachment.id] !== undefined
              ? attachmentOverrides[attachment.id]
              : attachment.attachmentType,
        })),
    [attachmentOverrides, projectAttachments, email?.id],
  );
  const attachmentTypeOptions = React.useMemo(
    () => buildAttachmentTypeOptions(projectAttachments),
    [projectAttachments],
  );

  const handleImportanceIntent = React.useCallback(
    (signal: EmailImportanceSignal) => {
      setImportanceSignal(signal);
      setImportanceDialogOpen(true);
    },
    [],
  );

  const handleSyncImportanceClassification = React.useCallback(
    async (signal: EmailImportanceSignal) => {
      if (!email) return;

      const projectAssignment =
        email.assistant_review?.projectAssignmentFeedback ?? {
          status: "unreviewed" as const,
          correctedProjectId: null,
          reasonSignals: [],
          reasonNote: null,
        };
      const fieldFeedback =
        email.assistant_review?.fieldFeedback ?? DEFAULT_FIELD_FEEDBACK;
      const existingReviewId = email.assistant_review?.reviewId;

      if (signal === "not_important") {
        if (existingReviewId) {
          await apiFetch("/api/email-inbox/reviewed", {
            method: "PATCH",
            body: JSON.stringify({
              reviewId: existingReviewId,
              assistantAction: "ignore",
              assistantPriority: "low",
              assistantCategory: "No Action",
              reviewOutcome: "marked_no_action",
              reviewerNote: email.assistant_review?.reviewerNote ?? null,
              draftBody: null,
              projectAssignment,
              fieldFeedback: {
                ...fieldFeedback,
                action: "incorrect",
                priority: "incorrect",
                category: "incorrect",
              },
            }),
          });
          return;
        }

        await apiFetch(`/api/email-inbox/${email.id}/assistant-review`, {
          method: "POST",
          body: JSON.stringify({
            assistantAction: "ignore",
            assistantPriority: "low",
            assistantCategory: "No Action",
            assistantScore: email.assistant_score ?? null,
            reviewOutcome: "marked_no_action",
            draftBody: null,
            reviewerNote: "Marked not important from inbox triage.",
            assistantReason: email.assistant_reason ?? null,
            assistantOwner: email.assistant_owner ?? null,
            assistantRisk: email.assistant_risk ?? null,
            assistantEvidence: email.assistant_evidence ?? null,
            projectAssignment,
            fieldFeedback: {
              ...fieldFeedback,
              action: "incorrect",
              priority: "incorrect",
              category: "incorrect",
            },
          }),
        });
        return;
      }

      const isArchivedAsNoAction =
        email.assistant_action === "ignore" ||
        email.assistant_review?.reviewOutcome === "marked_no_action";

      if (!isArchivedAsNoAction) {
        return;
      }

      const restoredCategory =
        email.assistant_category?.trim() &&
        email.assistant_category.trim() !== "No Action"
          ? email.assistant_category.trim()
          : email.assistant_review?.assistantCategory?.trim() &&
              email.assistant_review.assistantCategory.trim() !== "No Action"
            ? email.assistant_review.assistantCategory.trim()
            : null;

      if (existingReviewId) {
        await apiFetch("/api/email-inbox/reviewed", {
          method: "PATCH",
          body: JSON.stringify({
            reviewId: existingReviewId,
            assistantAction: "watch",
            assistantPriority: "normal",
            assistantCategory: restoredCategory,
            reviewOutcome: "watched",
            reviewerNote:
              email.assistant_review?.reviewerNote ??
              "Marked important from inbox triage.",
            draftBody: email.assistant_review?.draftBody ?? null,
            projectAssignment,
            fieldFeedback: {
              ...fieldFeedback,
              action: "incorrect",
              priority: "incorrect",
              category:
                fieldFeedback.category === "correct" ? "correct" : "unreviewed",
            },
          }),
        });
        return;
      }

      await apiFetch(`/api/email-inbox/${email.id}/assistant-review`, {
        method: "POST",
        body: JSON.stringify({
          assistantAction: "watch",
          assistantPriority: "normal",
          assistantCategory: restoredCategory,
          assistantScore: email.assistant_score ?? null,
          reviewOutcome: "watched",
          draftBody: null,
          reviewerNote: "Marked important from inbox triage.",
          assistantReason: email.assistant_reason ?? null,
          assistantOwner: email.assistant_owner ?? null,
          assistantRisk: email.assistant_risk ?? null,
          assistantEvidence: email.assistant_evidence ?? null,
          projectAssignment,
          fieldFeedback: {
            ...fieldFeedback,
            action: "incorrect",
            priority: "incorrect",
            category:
              fieldFeedback.category === "correct" ? "correct" : "unreviewed",
          },
        }),
      });
    },
    [email],
  );

  const handleAutoArchiveNotImportant = React.useCallback(async () => {
    if (!email) return;
    await handleSyncImportanceClassification("not_important");
  }, [email, handleSyncImportanceClassification]);

  const handleImportanceClear = React.useCallback(async () => {
    if (!email || isClearingImportance) return;

    setIsClearingImportance(true);
    try {
      await apiFetch("/api/ai-assistant/email-importance-feedback", {
        method: "DELETE",
        body: JSON.stringify({
          emailId: email.id,
          projectId: email.project_id,
          emailSnapshot: buildEmailImportanceSnapshot(email),
        }),
      });
      onImportanceCleared?.(email.id);
      toast.success("Importance feedback reverted.");
    } catch (error) {
      handleFormError(error, { entity: "email feedback", action: "update" });
    } finally {
      setIsClearingImportance(false);
    }
  }, [email, isClearingImportance, onImportanceCleared]);

  const handleAttachmentTypeUpdate = React.useCallback(
    (attachmentId: number, nextType: string | null) => {
      setAttachmentOverrides((current) => ({
        ...current,
        [attachmentId]: nextType,
      }));
    },
    [],
  );

  React.useEffect(() => {
    setSummaryOpen(false);
    setSummary(null);
    setSummaryLoading(false);
  }, [email?.id]);

  React.useEffect(() => {
    setDesktopActionsSlot(
      document.getElementById("email-details-actions-slot"),
    );
  }, [email?.id]);

  const handleSummarize = React.useCallback(async () => {
    if (!email) return;
    setSummaryOpen(true);
    if (summary) return;
    setSummaryLoading(true);
    try {
      const result = await apiFetch<{ summary: string }>(
        `/api/projects/${email.project_id}/emails/${email.id}/summarize`,
        { method: "POST" },
      );
      setSummary(result.summary);
    } catch (error) {
      setSummary(
        error instanceof Error
          ? `Could not generate summary: ${error.message}`
          : "Could not generate summary.",
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [email, summary]);

  const handleOpenCreateTask = React.useCallback(() => {
    if (!email) return;
    setTaskTitle(suggestedTaskTitle(email));
    setTaskDescription(suggestedTaskDescription(email));
    setTaskPriority("medium");
    setTaskStatus("open");
    setTaskDueDate("");
    setCreateTaskOpen(true);
  }, [email]);

  const handleCreateTask = React.useCallback(async () => {
    if (!email) return;

    const trimmedTitle = taskTitle.trim();
    const trimmedDescription = taskDescription.trim();

    if (!trimmedTitle || !trimmedDescription) {
      toast.error("Task title and description are required.");
      return;
    }

    setIsCreatingTask(true);
    try {
      await apiFetch(
        `/api/projects/${email.project_id}/emails/${email.id}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            title: trimmedTitle,
            description: trimmedDescription,
            dueDate: taskDueDate || null,
            priority: taskPriority,
            status: taskStatus,
          }),
        },
      );
      setCreateTaskOpen(false);
      toast.success("Task created from email.");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error && /already exists/i.test(error.message)
          ? "A matching task already exists for this email."
          : error instanceof Error
            ? error.message
            : "Could not create task from email.";
      toast.error(message);
    } finally {
      setIsCreatingTask(false);
    }
  }, [
    router,
    email,
    taskDescription,
    taskDueDate,
    taskPriority,
    taskStatus,
    taskTitle,
  ]);

  return (
    <>
      <AnimatePresence mode="wait">
        {email ? (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className={cn("flex h-full flex-col", className)}
            style={{ minHeight: "30rem" }}
          >
            <div className="px-4 sm:px-6 py-5 xl:px-12">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0 text-[15px] font-semibold leading-5 tracking-[-0.01em] text-foreground">
                      {email.subject || "Untitled email"}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-right text-[12px] text-muted-foreground">
                      {formatMetaDate(
                        email.received_at || email.sent_at || email.created_at,
                      )}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-y-1.5 text-[13px] text-muted-foreground sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-x-3">
                    <span className="font-medium text-foreground/75">From</span>
                    <span className="min-w-0 truncate text-foreground">
                      <span className="font-medium">
                        {email.from_name || "Unknown sender"}
                      </span>
                      {email.from_email ? `  ${email.from_email}` : ""}
                    </span>
                    <span className="font-medium text-foreground/75">To</span>
                    <span className="min-w-0 truncate text-foreground">
                      {formatRecipientLine(email.to_list)}
                    </span>
                    <span className="font-medium text-foreground/75">
                      Project
                    </span>
                    {canProjectEmailActions ? (
                      <ProjectAssignmentPopover
                        email={email}
                        variant="toolbar"
                      />
                    ) : (
                      <span className="min-w-0 truncate text-foreground">
                        {projectLabel(email.project) ?? "No project assigned"}
                      </span>
                    )}
                  </div>
                  <EmailActionControls
                    onSummarize={
                      canProjectEmailActions
                        ? () => void handleSummarize()
                        : undefined
                    }
                    importanceFeedback={importanceFeedback}
                    onImportanceIntent={handleImportanceIntent}
                    onImportanceClear={
                      importanceFeedback
                        ? () => void handleImportanceClear()
                        : undefined
                    }
                    isClearingImportance={isClearingImportance}
                    className="mt-4 border-t border-border/60 pt-4"
                    showTaskActions={false}
                  />
                </div>

                <div className="flex items-center gap-1 text-muted-foreground">
                  {showDetailsButton && onOpenDetails ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onOpenDetails}
                      aria-label="Open email content panel"
                      className="hidden h-8 w-8 rounded-full text-muted-foreground xl:inline-flex 2xl:hidden"
                    >
                      <MixerHorizontalIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canEditEmail && onEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(email)}
                      className="h-8 w-8 rounded-full"
                      aria-label="Edit email"
                    >
                      <Pencil1Icon className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canDelete && onDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(email)}
                      className="h-8 w-8 rounded-full"
                      aria-label="Delete email"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            {summaryOpen ? (
              <InfoAlert
                role="status"
                icon={
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                }
                className="items-start gap-2 rounded-none border-x-0 border-t-0 border-b border-border/60 bg-muted/30 px-4 sm:px-6 py-4 text-muted-foreground [&>div]:flex-1 xl:px-12"
              >
                <div className="flex w-full items-start gap-2">
                  {summaryLoading ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Summarizing…
                    </span>
                  ) : (
                    <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                      {summary}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSummaryOpen(false)}
                    aria-label="Close summary"
                    className="size-6 shrink-0 text-muted-foreground"
                  >
                    <Cross2Icon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </InfoAlert>
            ) : null}

            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-8 px-4 sm:px-6 pb-10 pt-10 xl:px-12">
                <div className="space-y-4 text-[14px] leading-6 text-foreground [overflow-wrap:anywhere]">
                  {selectedBody ? (
                    selectedBodyBlocks.map((block) => {
                      if (
                        block.kind === "metadata" ||
                        block.kind === "quote-header"
                      ) {
                        return null;
                      }

                      if (block.kind === "warning") {
                        return (
                          <div
                            key={block.id}
                            className="inline-flex rounded-full bg-warning/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-warning-foreground"
                          >
                            {block.lines.join(" ")}
                          </div>
                        );
                      }

                      return (
                        <div key={block.id} className="space-y-3">
                          {block.lines.map((line) => (
                            <p
                              key={`${block.id}-${line}`}
                              className="whitespace-pre-wrap break-words"
                            >
                              {line}
                            </p>
                          ))}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-muted-foreground">
                      This draft does not have body copy yet.
                    </p>
                  )}
                </div>

                {selectedAttachments.length > 0 ? (
                  <div className="space-y-3 border-t border-border/60 pt-5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      {selectedAttachments.length}{" "}
                      {selectedAttachments.length === 1
                        ? "Attachment"
                        : "Attachments"}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {selectedAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="space-y-3 rounded-2xl border border-border/70 p-3"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPreviewAttachment(attachment)}
                            disabled={!isPreviewableAttachment(attachment)}
                            aria-label={`Preview ${attachment.fileName}`}
                            className={cn(
                              "flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/30 p-0 disabled:opacity-100",
                              isPreviewableAttachment(attachment) &&
                                "hover:bg-muted/50",
                            )}
                          >
                            {isImageAttachment(attachment) ? (
                              <img
                                src={previewUrl(
                                  email.project_id,
                                  attachment.id,
                                )}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : isPdfAttachment(attachment) ? (
                              <PdfDocument
                                file={previewUrl(
                                  email.project_id,
                                  attachment.id,
                                )}
                                loading={
                                  <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                                }
                                error={
                                  <FileTextIcon className="h-5 w-5 text-muted-foreground" />
                                }
                              >
                                <PdfPage
                                  pageNumber={1}
                                  width={160}
                                  renderAnnotationLayer={false}
                                  renderTextLayer={false}
                                />
                              </PdfDocument>
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </Button>
                          <div className="space-y-1">
                            <div className="truncate text-sm font-medium text-foreground">
                              {attachment.fileName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatBytes(attachment.fileSize)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <AttachmentTypePopover
                              attachment={attachment}
                              projectId={email.project_id}
                              availableTypes={attachmentTypeOptions}
                              onUpdated={handleAttachmentTypeUpdate}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                window.open(
                                  attachmentUrl(
                                    email.project_id,
                                    attachment.id,
                                  ),
                                  "_blank",
                                )
                              }
                              aria-label={`Download ${attachment.fileName}`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <EmailActionControls
                  onSummarize={
                    canProjectEmailActions
                      ? () => void handleSummarize()
                      : undefined
                  }
                  importanceFeedback={importanceFeedback}
                  onImportanceIntent={handleImportanceIntent}
                  onImportanceClear={
                    importanceFeedback
                      ? () => void handleImportanceClear()
                      : undefined
                  }
                  isClearingImportance={isClearingImportance}
                  onCreateTask={
                    canProjectEmailActions ? handleOpenCreateTask : undefined
                  }
                  className="border-t border-border/60 pt-5"
                  showImportanceControls={false}
                />
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <motion.div
            key="empty-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "flex h-full items-center justify-center px-4 sm:px-6 py-12 xl:px-12",
              className,
            )}
            style={{ minHeight: "30rem" }}
          >
            <div className="max-w-md text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-muted text-muted-foreground">
                <EnvelopeClosedIcon className="h-6 w-6" />
              </div>
              <div className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                Nothing selected
              </div>
              <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
                Select a message from the inbox rail
                {canCompose ? " or start a new draft" : ""}. This center pane is
                where the thread stays in focus.
              </p>
              {canCompose && onCompose ? (
                <Button
                  size="sm"
                  onClick={onCompose}
                  className="mt-6 h-10 rounded-full px-4 shadow-none"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Compose email
                </Button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {email && desktopActionsSlot
        ? createPortal(
            <EmailActionControls
              onSummarize={
                canProjectEmailActions
                  ? () => void handleSummarize()
                  : undefined
              }
              importanceFeedback={importanceFeedback}
              onImportanceIntent={handleImportanceIntent}
              onImportanceClear={
                importanceFeedback ? () => void handleImportanceClear() : undefined
              }
              isClearingImportance={isClearingImportance}
              onCreateTask={
                canProjectEmailActions ? handleOpenCreateTask : undefined
              }
              orientation="column"
              showImportanceControls={false}
            />,
            desktopActionsSlot,
          )
        : null}
      <EmailImportanceFeedbackDialog
        email={email}
        open={importanceDialogOpen}
        signal={importanceSignal}
        existingFeedback={importanceFeedback}
        onOpenChange={(open) => {
          setImportanceDialogOpen(open);
          if (!open) {
            setImportanceSignal(null);
          }
        }}
        onRecorded={async (emailId, feedback) => {
          if (feedback.signal === "not_important") {
            await handleAutoArchiveNotImportant();
          } else {
            await handleSyncImportanceClassification("important");
          }
          setImportanceDialogOpen(false);
          setImportanceSignal(null);
          await onImportanceRecorded?.(emailId, feedback);
        }}
      />
      <AttachmentPreviewModal
        attachment={previewAttachment}
        projectId={email?.project_id ?? 0}
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => {
          if (!open) setPreviewAttachment(null);
        }}
      />
      <Modal open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <ModalContent size="lg">
          <ModalHeader>
            <ModalTitle>Create task from email</ModalTitle>
            <ModalDescription>
              Capture a follow-up without leaving the thread.
            </ModalDescription>
          </ModalHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                Title
              </div>
              <Input
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="What needs to happen?"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                Description
              </div>
              <Textarea
                value={taskDescription}
                onChange={(event) => setTaskDescription(event.target.value)}
                rows={7}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Priority
                </div>
                <Select
                  value={taskPriority}
                  onValueChange={(value) =>
                    setTaskPriority(value as typeof taskPriority)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Status
                </div>
                <Select
                  value={taskStatus}
                  onValueChange={(value) =>
                    setTaskStatus(value as typeof taskStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Due date
                </div>
                <Input
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </div>
            </div>
          </div>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateTaskOpen(false)}
              disabled={isCreatingTask}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateTask()}
              disabled={isCreatingTask}
            >
              {isCreatingTask ? "Creating..." : "Create task"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function EmailDetailsPanel({
  selectedEmail,
  primaryContact,
  contextItems,
  className,
  onClose,
}: {
  selectedEmail: ProjectEmail | null;
  primaryContact: ReturnType<typeof resolvePrimaryContact> | null;
  contextItems: Array<{
    icon: React.ReactNode;
    label: string;
    value: string;
  }>;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="px-6 py-6">
        {selectedEmail && primaryContact ? (
          <>
            {onClose ? (
              <div className="mb-4 flex items-center justify-end 2xl:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close details panel"
                  className="h-8 w-8 rounded-full text-muted-foreground"
                >
                  <Cross2Icon className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="space-y-3 pb-6">
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-muted text-sm font-semibold text-foreground">
                      {getInitials(primaryContact.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-xl font-semibold tracking-[-0.02em] break-all text-foreground [overflow-wrap:anywhere]">
                      {primaryContact.displayName}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {primaryContact.roleLabel}
                    </div>
                    {primaryContact.linkLabel ? (
                      <div className="mt-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {primaryContact.linkLabel}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 py-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Details
              </div>
              {contextItems.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 text-sm"
                >
                  <div className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="break-all text-foreground [overflow-wrap:anywhere]">
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pb-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Actions
              </div>
              <div id="email-details-actions-slot" />
            </div>

            <div className="space-y-4 border-t border-border/70 pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Related
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedEmail.related_tool ? (
                  <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {selectedEmail.related_tool}
                  </span>
                ) : null}
                {selectedEmail.distribution_group ? (
                  <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {selectedEmail.distribution_group}
                  </span>
                ) : null}
                {!selectedEmail.related_tool &&
                !selectedEmail.distribution_group ? (
                  <span className="text-sm text-muted-foreground">
                    No linked workflow metadata yet.
                  </span>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Workspace notes
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: <EnvelopeClosedIcon className="h-4 w-4" />,
                  title: "Inbox",
                  body: "Incoming and draft messages stay in the left rail so the main thread remains quiet and readable.",
                },
                {
                  icon: <MixerHorizontalIcon className="h-4 w-4" />,
                  title: "Search",
                  body: "Keep the left rail quiet, then expand search only when you need to narrow a busy project thread.",
                },
                {
                  icon: <FileTextIcon className="h-4 w-4" />,
                  title: "Context",
                  body: "Sender, recipients, timestamps, and linked workflow metadata stay pinned on the right.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <div className="mt-1 text-muted-foreground">{item.icon}</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {item.title}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

type ProjectAssignmentFeedbackStatus = "correct" | "incorrect" | "unreviewed";
type AssistantReviewAction = "reply" | "delegate" | "watch" | "ignore";
type AssistantReviewPriority = "urgent" | "high" | "normal" | "low";
type AssistantFieldVerdict = "correct" | "incorrect" | "unreviewed";
type AssistantFieldKey =
  | "action"
  | "priority"
  | "category"
  | "draft"
  | "project"
  | "owner"
  | "reason"
  | "score";
type BrandonReviewOutcome =
  | "draft_copied"
  | "draft_edited"
  | "skipped"
  | "delegated"
  | "watched"
  | "marked_no_action";

const REVIEW_OUTCOME_LABELS: Record<BrandonReviewOutcome, string> = {
  draft_copied: "Draft copied",
  draft_edited: "Draft edited",
  skipped: "Skipped",
  delegated: "Delegated",
  watched: "Watched",
  marked_no_action: "No action",
};

const ASSISTANT_ACTION_OPTIONS: {
  value: AssistantReviewAction;
  label: string;
}[] = [
  { value: "reply", label: "Reply" },
  { value: "delegate", label: "Delegate" },
  { value: "watch", label: "Watch" },
  { value: "ignore", label: "Ignore" },
];

const ASSISTANT_PRIORITY_OPTIONS: {
  value: AssistantReviewPriority;
  label: string;
}[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const ASSISTANT_CATEGORY_OPTIONS = [
  "Accounting",
  "Client Follow-up",
  "Sales Lead",
  "Vendor / Subcontractor",
  "Internal Coordination",
  "Scheduling",
  "Operations / Admin",
  "Reply Needed",
  "To Delegate",
  "Watching",
  "FYI",
  "No Action",
  "Urgent",
] as const;

const PROJECT_ASSIGNMENT_REASON_OPTIONS: Array<{
  value: ProjectAssignmentReasonSignal;
  label: string;
}> = [
  { value: "subject_line", label: "Subject line" },
  { value: "sender", label: "Sender" },
  { value: "message_body", label: "Message body" },
  { value: "attachment", label: "Attachment" },
  { value: "existing_project_context", label: "Existing project context" },
  { value: "other", label: "Other" },
];

const DEFAULT_FIELD_FEEDBACK: Record<AssistantFieldKey, AssistantFieldVerdict> = {
  action: "unreviewed",
  priority: "unreviewed",
  category: "unreviewed",
  draft: "unreviewed",
  project: "unreviewed",
  owner: "unreviewed",
  reason: "unreviewed",
  score: "unreviewed",
};

const QUICK_CATEGORY_OPTIONS = [
  "Accounting",
  "Client Follow-up",
  "Sales Lead",
  "Vendor / Subcontractor",
  "No Action",
] as const;

const BUSINESS_CATEGORY_OPTIONS = [
  "Accounting",
  "Client Follow-up",
  "Sales Lead",
  "Vendor / Subcontractor",
  "Internal Coordination",
  "Scheduling",
  "Operations / Admin",
  "No Action",
] as const;

function isBusinessCategory(value: string | null | undefined): boolean {
  return BUSINESS_CATEGORY_OPTIONS.includes(
    (value ?? "") as (typeof BUSINESS_CATEGORY_OPTIONS)[number],
  );
}

function defaultAssistantCategory(email: ProjectEmail): string {
  if (email.assistant_category?.trim()) return email.assistant_category.trim();
  switch (email.assistant_action) {
    case "reply":
      return "Reply Needed";
    case "delegate":
      return "To Delegate";
    case "watch":
      return "Watching";
    case "ignore":
      return "No Action";
    default:
      return "FYI";
  }
}

function defaultReviewOutcome(email: ProjectEmail): BrandonReviewOutcome {
  if (email.assistant_review?.reviewOutcome)
    return email.assistant_review.reviewOutcome;
  if (email.assistant_review?.draftBody?.trim()) return "draft_edited";
  if (email.assistant_action === "delegate") return "delegated";
  if (email.assistant_action === "watch") return "watched";
  if (email.assistant_action === "ignore") return "marked_no_action";
  return "skipped";
}

function formatProjectOption(project: Project): string {
  return project.project_number
    ? `${project.project_number} - ${project.name ?? `Project ${project.id}`}`
    : (project.name ?? `Project ${project.id}`);
}

function formatFeedbackDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function ReviewSection({
  title,
  defaultOpen = true,
  accent = false,
  headerAction,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  accent?: boolean;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="rounded-lg border border-border/70 bg-background"
    >
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="group flex h-auto min-w-0 flex-1 items-center justify-between gap-3 px-0 py-0 text-left hover:bg-transparent"
            >
              <span
                className={cn(
                  "text-[13px] font-medium text-foreground",
                  accent && "text-[hsl(var(--warning-foreground))]",
                )}
              >
                {title}
              </span>
              <ChevronDownIcon
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </Button>
          </CollapsibleTrigger>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      </div>
      <CollapsibleContent className="px-4 pb-4 pt-0">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReviewRow({
  icon: Icon,
  label,
  value,
  verdict = "unreviewed",
  onVerdictChange,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  verdict?: AssistantFieldVerdict;
  onVerdictChange?: (next: AssistantFieldVerdict) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1",
        className,
      )}
    >
      <span
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
        aria-label={label}
        title={label}
        aria-hidden
      >
        <Icon className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1 text-[13px] text-muted-foreground">
        {value}
      </div>
      {onVerdictChange ? (
        <VerdictButtons
          label={label}
          verdict={verdict}
          onVerdictChange={onVerdictChange}
        />
      ) : null}
    </div>
  );
}

function VerdictButtons({
  label,
  verdict,
  onVerdictChange,
  compact = true,
}: {
  label: string;
  verdict: AssistantFieldVerdict;
  onVerdictChange: (next: AssistantFieldVerdict) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${label} correct`}
        onClick={() =>
          onVerdictChange(verdict === "correct" ? "unreviewed" : "correct")
        }
        className={cn(
          compact ? "h-6 w-6" : "h-7 w-7",
          "rounded-full border border-emerald-200/80 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800",
          verdict !== "correct" && "opacity-75",
          verdict === "correct" &&
            "!border-emerald-300 !bg-emerald-100 !text-emerald-800 opacity-100 hover:!bg-emerald-100 hover:!text-emerald-800",
        )}
      >
        <CheckCheck className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${label} incorrect`}
        onClick={() =>
          onVerdictChange(verdict === "incorrect" ? "unreviewed" : "incorrect")
        }
        className={cn(
          compact ? "h-6 w-6" : "h-7 w-7",
          "rounded-full border border-red-200/80 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-800",
          verdict !== "incorrect" && "opacity-75",
          verdict === "incorrect" &&
            "!border-red-300 !bg-red-100 !text-red-800 opacity-100 hover:!bg-red-100 hover:!text-red-800",
        )}
      >
        <X className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
    </div>
  );
}

export function EmailTrainingFeedbackPanel({
  selectedEmail,
  className,
  onClose,
  onSaved,
}: {
  selectedEmail: ProjectEmail | null;
  className?: string;
  onClose?: () => void;
  onSaved?: () => void;
}) {
  const { projects, isLoading: projectsLoading } = useProjects({ limit: 250 });
  const [assistantAction, setAssistantAction] =
    React.useState<AssistantReviewAction>("watch");
  const [assistantPriority, setAssistantPriority] =
    React.useState<AssistantReviewPriority>("normal");
  const [assistantCategory, setAssistantCategory] = React.useState("FYI");
  const [quickCategory, setQuickCategory] = React.useState("");
  const [reviewOutcome, setReviewOutcome] =
    React.useState<BrandonReviewOutcome>("skipped");
  const [draftBody, setDraftBody] = React.useState("");
  const [reviewerNote, setReviewerNote] = React.useState("");
  const [fieldFeedback, setFieldFeedback] = React.useState<
    Record<AssistantFieldKey, AssistantFieldVerdict>
  >(DEFAULT_FIELD_FEEDBACK);
  const [projectStatus, setProjectStatus] =
    React.useState<ProjectAssignmentFeedbackStatus>("unreviewed");
  const [correctedProjectId, setCorrectedProjectId] = React.useState<
    number | null
  >(null);
  const [projectReasonSignals, setProjectReasonSignals] = React.useState<
    ProjectAssignmentReasonSignal[]
  >([]);
  const [projectReasonNote, setProjectReasonNote] = React.useState("");
  const [feedbackProvidedAt, setFeedbackProvidedAt] = React.useState<
    string | null
  >(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = React.useState(false);

  React.useEffect(() => {
    if (!selectedEmail) return;
    const assignmentFeedback =
      selectedEmail.assistant_review?.projectAssignmentFeedback;
    setAssistantAction(selectedEmail.assistant_action ?? "watch");
    setAssistantPriority(selectedEmail.assistant_priority ?? "normal");
    setAssistantCategory(defaultAssistantCategory(selectedEmail));
    setQuickCategory(
      isBusinessCategory(selectedEmail.assistant_category)
        ? selectedEmail.assistant_category ?? ""
        : "",
    );
    setReviewOutcome(defaultReviewOutcome(selectedEmail));
    setDraftBody(selectedEmail.assistant_review?.draftBody ?? "");
    setReviewerNote(selectedEmail.assistant_review?.reviewerNote ?? "");
    setFieldFeedback(selectedEmail.assistant_review?.fieldFeedback ?? DEFAULT_FIELD_FEEDBACK);
    setProjectStatus(assignmentFeedback?.status ?? "unreviewed");
    setCorrectedProjectId(
      assignmentFeedback?.correctedProjectId ??
        (typeof selectedEmail.project_id === "number"
          ? selectedEmail.project_id
          : null),
    );
    setProjectReasonSignals(assignmentFeedback?.reasonSignals ?? []);
    setProjectReasonNote(assignmentFeedback?.reasonNote ?? "");
    setFeedbackProvidedAt(
      selectedEmail.assistant_review?.feedbackProvidedAt ?? null,
    );
  }, [selectedEmail]);

  const selectedProjectLabel =
    projectLabel(selectedEmail?.project) ?? "No project assigned";
  const normalizedScore =
    typeof selectedEmail?.assistant_score === "number"
      ? Math.round(selectedEmail.assistant_score)
      : null;
  const savedLabel = formatFeedbackDate(feedbackProvidedAt);
  const rulesApplied = selectedEmail?.assistant_rules_applied ?? [];
  const assistantContext = selectedEmail?.assistant_evidence?.trim() ?? "";
  const hasReviewedField = React.useMemo(
    () => Object.values(fieldFeedback).some((value) => value !== "unreviewed"),
    [fieldFeedback],
  );
  const categoryOptions = React.useMemo(() => {
    const options = new Set<string>(BUSINESS_CATEGORY_OPTIONS);
    const current = quickCategory.trim();
    if (current) options.add(current);
    return Array.from(options);
  }, [quickCategory]);

  async function handleSave() {
    if (!selectedEmail) return;
    if (projectStatus === "incorrect" && !correctedProjectId) {
      toast.error("Choose the correct project before saving feedback.");
      return;
    }
    if (projectStatus !== "unreviewed" && projectReasonSignals.length === 0) {
      toast.error("Choose at least one reason for how the project was identified.");
      return;
    }
    if (
      projectReasonSignals.includes("other") &&
      !projectReasonNote.trim()
    ) {
      toast.error("Add a note when using Other for project assignment reasoning.");
      return;
    }

    setIsSaving(true);
    try {
      const projectAssignment = {
        status: projectStatus,
        correctedProjectId:
          projectStatus === "incorrect" ? correctedProjectId : null,
        reasonSignals: projectStatus === "unreviewed" ? [] : projectReasonSignals,
        reasonNote:
          projectStatus === "unreviewed" ? null : projectReasonNote.trim() || null,
      };
      const commonPayload = {
        assistantAction,
        assistantPriority,
        assistantCategory:
          quickCategory.trim() || assistantCategory.trim() || null,
        reviewOutcome,
        reviewerNote: reviewerNote.trim() || null,
        draftBody: draftBody.trim() || null,
        projectAssignment,
        fieldFeedback,
      };

      if (selectedEmail.assistant_review?.reviewId) {
        await apiFetch("/api/email-inbox/reviewed", {
          method: "PATCH",
          body: JSON.stringify({
            reviewId: selectedEmail.assistant_review.reviewId,
            ...commonPayload,
          }),
        });
      } else {
        await apiFetch(
          `/api/email-inbox/${selectedEmail.id}/assistant-review`,
          {
            method: "POST",
            body: JSON.stringify({
              // assistantAction / assistantPriority come from `...commonPayload`
              // below — do not repeat them here (TS2783 duplicate key).
              assistantScore: selectedEmail.assistant_score ?? null,
              assistantReason: selectedEmail.assistant_reason ?? null,
              assistantOwner: selectedEmail.assistant_owner ?? null,
              assistantRisk: selectedEmail.assistant_risk ?? null,
              assistantEvidence: selectedEmail.assistant_evidence ?? null,
              ...commonPayload,
            }),
          },
        );
      }

      const now = new Date().toISOString();
      setFeedbackProvidedAt(now);
      toast.success("Feedback saved for AI training.");
      onSaved?.();
    } catch (error) {
      console.error("Could not save email training feedback.", error);
      toast.error(
        "Could not save feedback. Check the selected review and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const quickCategoryDirty = React.useMemo(() => {
    if (!selectedEmail) return false;
    const baseline = isBusinessCategory(selectedEmail.assistant_category)
      ? selectedEmail.assistant_category ?? ""
      : "";
    return quickCategory.trim() !== baseline;
  }, [quickCategory, selectedEmail]);

  const updateQuickCategory = React.useCallback(
    (nextCategory: string) => {
      setQuickCategory(nextCategory);
      setFieldFeedback((current) => ({
        ...current,
        category: nextCategory.trim() ? "incorrect" : "unreviewed",
      }));
    },
    [],
  );

  async function handleGenerateDraft() {
    if (!selectedEmail) return;

    setIsGeneratingDraft(true);
    try {
      const result = await apiFetch<{ draft: string }>(
        `/api/email-inbox/${selectedEmail.id}/draft-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: selectedEmail.subject,
            fromName: selectedEmail.from_name,
            fromEmail: selectedEmail.from_email,
            bodyText: selectedEmail.body_text ?? selectedEmail.body,
            projectName: selectedEmail.project?.name ?? null,
            tone: "professional",
          }),
        },
      );
      setDraftBody(result.draft);
      toast.success("Sandbox draft generated.");
    } catch (error) {
      console.error("Could not generate sandbox email draft.", error);
      toast.error("Could not generate sandbox draft. Check AI configuration.");
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="bg-muted/20 px-4 py-4">
        {selectedEmail ? (
          <div className="space-y-4">
            {onClose ? (
              <div className="flex items-center justify-end 2xl:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close feedback panel"
                  className="h-8 w-8 rounded-full text-muted-foreground"
                >
                  <Cross2Icon className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="space-y-1 pr-10">
              <div className="text-sm font-semibold text-foreground">
                AI Review
              </div>
              {savedLabel ? (
                <div className="text-xs text-muted-foreground">{savedLabel}</div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No human feedback recorded.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <ReviewSection title="AI Classification" accent>
                <div className="space-y-0.5">
                  <ReviewRow
                    icon={ListTodo}
                    label="Action"
                    verdict={fieldFeedback.action}
                    onVerdictChange={(next) =>
                      setFieldFeedback((current) => ({ ...current, action: next }))
                    }
                    value={
                      <Select
                        value={assistantAction}
                        onValueChange={(value) =>
                          setAssistantAction(value as AssistantReviewAction)
                        }
                      >
                        <SelectTrigger className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSISTANT_ACTION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    }
                  />
                  <ReviewRow
                    icon={Flag}
                    label="Priority"
                    verdict={fieldFeedback.priority}
                    onVerdictChange={(next) =>
                      setFieldFeedback((current) => ({ ...current, priority: next }))
                    }
                    value={
                      <Select
                        value={assistantPriority}
                        onValueChange={(value) =>
                          setAssistantPriority(value as AssistantReviewPriority)
                        }
                      >
                        <SelectTrigger className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSISTANT_PRIORITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    }
                  />
                  <ReviewRow
                    icon={FolderOpen}
                    label="Category"
                    verdict={fieldFeedback.category}
                    onVerdictChange={(next) =>
                      setFieldFeedback((current) => ({ ...current, category: next }))
                    }
                    value={
                      assistantCategory
                    }
                  />
                  <ReviewRow
                    icon={FolderOpen}
                    label="Project"
                    verdict={fieldFeedback.project}
                    onVerdictChange={(next) => {
                      setFieldFeedback((current) => ({ ...current, project: next }));
                      setProjectStatus(next);
                    }}
                    value={
                      <div className="space-y-2">
                        <div>{selectedProjectLabel}</div>
                        {projectStatus !== "unreviewed" ? (
                          <div className="grid gap-2.5">
                            {projectStatus === "incorrect" ? (
                              <Select
                                value={
                                  correctedProjectId
                                    ? String(correctedProjectId)
                                    : undefined
                                }
                                onValueChange={(value) =>
                                  setCorrectedProjectId(Number(value))
                                }
                              >
                                <SelectTrigger className="h-8 text-[13px]">
                                  <SelectValue
                                    placeholder={
                                      projectsLoading
                                        ? "Loading projects..."
                                        : "Correct project"
                                    }
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  {projects.map((project) => (
                                    <SelectItem
                                      key={project.id}
                                      value={String(project.id)}
                                    >
                                      {formatProjectOption(project)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : null}
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                How did you know?
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {PROJECT_ASSIGNMENT_REASON_OPTIONS.map((option) => {
                                  const selected = projectReasonSignals.includes(option.value);
                                  return (
                                    <Button
                                      key={option.value}
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setProjectReasonSignals((current) =>
                                          current.includes(option.value)
                                            ? current.filter((value) => value !== option.value)
                                            : [...current, option.value],
                                        )
                                      }
                                      className={cn(
                                        "h-7 rounded-full border px-2.5 text-[11px] font-medium shadow-none",
                                        selected
                                          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10"
                                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted/60",
                                      )}
                                    >
                                      {option.label}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                            <Textarea
                              value={projectReasonNote}
                              onChange={(event) =>
                                setProjectReasonNote(event.target.value)
                              }
                              placeholder="Add context about how you identified the project."
                              className="min-h-20 resize-y text-[13px] leading-5"
                            />
                          </div>
                        ) : null}
                      </div>
                    }
                  />
                  <ReviewRow
                    icon={User}
                    label="Owner"
                    verdict={fieldFeedback.owner}
                    onVerdictChange={(next) =>
                      setFieldFeedback((current) => ({ ...current, owner: next }))
                    }
                    value={selectedEmail.assistant_owner ?? "Unknown"}
                  />
                  <ReviewRow
                    icon={MessageSquareText}
                    label="Reason"
                    verdict={fieldFeedback.reason}
                    onVerdictChange={(next) =>
                      setFieldFeedback((current) => ({ ...current, reason: next }))
                    }
                    value={
                      selectedEmail.assistant_reason ?? "No reason recorded."
                    }
                    className="items-start"
                  />
                  <ReviewRow
                    icon={Gauge}
                    label="Score"
                    verdict={fieldFeedback.score}
                    onVerdictChange={(next) =>
                      setFieldFeedback((current) => ({ ...current, score: next }))
                    }
                    value={normalizedScore ?? "Unknown"}
                  />
                </div>
              </ReviewSection>

              <ReviewSection
                title="Draft Reply"
                headerAction={
                  <div className="flex items-center gap-2">
                    <VerdictButtons
                      label="Draft reply"
                      verdict={fieldFeedback.draft}
                      onVerdictChange={(next) =>
                        setFieldFeedback((current) => ({
                          ...current,
                          draft: next,
                        }))
                      }
                      compact={false}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleGenerateDraft()}
                      disabled={isGeneratingDraft}
                      className="h-7 text-[12px]"
                    >
                      {isGeneratingDraft ? (
                        <Loader2
                          className="mr-2 h-3.5 w-3.5 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Sparkles className="mr-2 h-3.5 w-3.5" aria-hidden />
                      )}
                      {isGeneratingDraft ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                }
              >
                <Textarea
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder="Draft response"
                  className="min-h-24 resize-y border-0 bg-transparent px-0 text-[13px] leading-5 shadow-none"
                />
              </ReviewSection>

              <ReviewSection title="Rules Applied">
                <div className="space-y-2">
                  {rulesApplied.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {rulesApplied.map((rule) => (
                        <span
                          key={rule}
                          className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          <Sparkles className="h-2.5 w-2.5" aria-hidden />
                          <span>{rule}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">
                      No rule matches were recorded for this email.
                    </p>
                  )}
                  {assistantContext ? (
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      {assistantContext}
                    </p>
                  ) : null}
                </div>
              </ReviewSection>

              <ReviewSection
                title="Quick Category"
                headerAction={
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={isSaving || !quickCategoryDirty}
                    className="h-7 text-[12px]"
                  >
                    {isSaving ? "Saving..." : "Save category"}
                  </Button>
                }
              >
                <div className="space-y-3">
                  <p className="text-[12px] leading-5 text-muted-foreground">
                    Use this for the business label on the email. The AI
                    workflow bucket above can still stay as delegate, reply, or
                    watch.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CATEGORY_OPTIONS.map((category) => {
                      const selected = quickCategory === category;
                      return (
                        <Button
                          key={category}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => updateQuickCategory(category)}
                          className={cn(
                            "h-7 rounded-full border px-2.5 text-[11px] font-medium shadow-none",
                            selected
                              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10"
                              : "border-border/60 bg-background text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          {category}
                        </Button>
                      );
                    })}
                  </div>
                  <Select
                    value={quickCategory || "__none__"}
                    onValueChange={(value) =>
                      updateQuickCategory(value === "__none__" ? "" : value)
                    }
                  >
                    <SelectTrigger className="h-8 text-[13px]">
                      <SelectValue placeholder="Choose business category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No business category</SelectItem>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </ReviewSection>

              <ReviewSection
                title="Feedback Notes"
                headerAction={
                  <Button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    size="sm"
                    className="h-7 text-[12px]"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                }
              >
                <div className="space-y-3">
                  <Textarea
                    value={reviewerNote}
                    onChange={(event) => setReviewerNote(event.target.value)}
                    placeholder="Add additional notes for AI feedback here."
                    className="min-h-20 resize-y border-0 bg-transparent px-0 text-[13px] leading-5 shadow-none"
                  />
                  {hasReviewedField ? (
                    <div className="grid gap-2 border-t border-border/50 pt-3">
                      <Select
                        value={reviewOutcome}
                        onValueChange={(value) =>
                          setReviewOutcome(value as BrandonReviewOutcome)
                        }
                      >
                        <SelectTrigger className="h-8 text-[13px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(
                              REVIEW_OUTCOME_LABELS,
                            ) as BrandonReviewOutcome[]
                          ).map((outcome) => (
                            <SelectItem key={outcome} value={outcome}>
                              {REVIEW_OUTCOME_LABELS[outcome]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </ReviewSection>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              AI Training
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Select an email to review the AI categorization, draft, rules, and
              project assignment.
            </p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export function ProjectEmailsWorkspace({
  emails,
  isLoading,
  error,
  title = "Emails",
  description,
  tabs,
  searchValue,
  onSearchChange,
  canEdit,
  canCompose = true,
  canDelete = true,
  viewSwitcher,
  filterControl,
  sortBy,
  sortDirection,
  onSortChange,
  draftFeedbackMode = false,
  onDraftFeedbackSaved,
  importanceFeedbackByEmailId = {},
  onImportanceRecorded,
  onImportanceCleared,
  onCompose,
  onEdit,
  onDelete,
}: ProjectEmailsWorkspaceProps) {
  const rightRailDefaultWidth = draftFeedbackMode
    ? 360
    : EMAIL_WORKSPACE_RIGHT_DEFAULT;
  const rightRailMinWidth = draftFeedbackMode ? 320 : EMAIL_WORKSPACE_RIGHT_MIN;
  const rightRailMaxWidth = draftFeedbackMode ? 420 : EMAIL_WORKSPACE_RIGHT_MAX;
  const [selectedEmailId, setSelectedEmailId] = React.useState<number | null>(
    null,
  );
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = React.useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(
    () => searchValue.trim().length > 0,
  );
  const [layoutPreference, setLayoutPreference] =
    React.useState<EmailWorkspaceLayoutPreference>({
      leftWidth: EMAIL_WORKSPACE_LEFT_DEFAULT,
      rightWidth: rightRailDefaultWidth,
      leftCollapsed: false,
      rightCollapsed: false,
    });
  const [isWorkspaceLayoutReady, setIsWorkspaceLayoutReady] =
    React.useState(false);
  const workspaceResizeRef = React.useRef<{
    column: EmailWorkspaceColumn;
    startX: number;
    startWidth: number;
  } | null>(null);
  const layoutPreferenceRef = React.useRef(layoutPreference);

  React.useEffect(() => {
    layoutPreferenceRef.current = layoutPreference;
  }, []);

  React.useEffect(() => {
    setLayoutPreference(loadEmailWorkspaceLayout());
    setIsWorkspaceLayoutReady(true);
  }, []);

  React.useEffect(() => {
    setLayoutPreference((current) => {
      const clampedRightWidth = clampNumber(
        current.rightWidth,
        rightRailMinWidth,
        rightRailMaxWidth,
      );
      if (clampedRightWidth === current.rightWidth) return current;
      const next = { ...current, rightWidth: clampedRightWidth };
      saveEmailWorkspaceLayout(next);
      return next;
    });
  }, [rightRailMaxWidth, rightRailMinWidth]);

  const persistLayoutPreference = React.useCallback(
    (
      updater: (
        current: EmailWorkspaceLayoutPreference,
      ) => EmailWorkspaceLayoutPreference,
    ) => {
      setLayoutPreference((current) => {
        const next = updater(current);
        saveEmailWorkspaceLayout(next);
        return next;
      });
    },
    [],
  );

  const toggleWorkspaceColumn = React.useCallback(
    (column: EmailWorkspaceColumn) => {
      persistLayoutPreference((current) =>
        column === "left"
          ? { ...current, leftCollapsed: !current.leftCollapsed }
          : { ...current, rightCollapsed: !current.rightCollapsed },
      );
    },
    [persistLayoutPreference],
  );

  const handleWorkspaceResizeStart = React.useCallback(
    (column: EmailWorkspaceColumn) =>
      (event: React.MouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        workspaceResizeRef.current = {
          column,
          startX: event.clientX,
          startWidth:
            column === "left"
              ? layoutPreference.leftWidth
              : layoutPreference.rightWidth,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      },
    [layoutPreference.leftWidth, layoutPreference.rightWidth],
  );

  React.useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const drag = workspaceResizeRef.current;
      if (!drag) return;

      const delta =
        drag.column === "left"
          ? event.clientX - drag.startX
          : drag.startX - event.clientX;
      const min =
        drag.column === "left"
          ? EMAIL_WORKSPACE_LEFT_MIN
          : rightRailMinWidth;
      const max =
        drag.column === "left"
          ? EMAIL_WORKSPACE_LEFT_MAX
          : rightRailMaxWidth;
      const nextWidth = clampNumber(drag.startWidth + delta, min, max);

      setLayoutPreference((current) => {
        const next =
          drag.column === "left"
            ? { ...current, leftWidth: nextWidth, leftCollapsed: false }
            : { ...current, rightWidth: nextWidth, rightCollapsed: false };
        layoutPreferenceRef.current = next;
        return next;
      });
    }

    function handleMouseUp() {
      const drag = workspaceResizeRef.current;
      if (!drag) return;
      workspaceResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      saveEmailWorkspaceLayout(layoutPreferenceRef.current);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [layoutPreference, rightRailMaxWidth, rightRailMinWidth]);

  React.useEffect(() => {
    if (searchValue.trim().length > 0) {
      setIsSearchExpanded(true);
    }
  }, [searchValue]);

  // Filtering (status, source, attachments, starred, date) is applied upstream
  // in EmailsClient via the shared filter state, so the rail renders the list
  // as-given.
  const visibleEmails = emails;

  React.useEffect(() => {
    if (visibleEmails.length === 0) {
      setSelectedEmailId(null);
      return;
    }

    setSelectedEmailId((current) => {
      if (current && visibleEmails.some((email) => email.id === current))
        return current;
      return visibleEmails[0]?.id ?? null;
    });
  }, [visibleEmails]);

  const selectedEmail = React.useMemo(
    () => visibleEmails.find((email) => email.id === selectedEmailId) ?? null,
    [visibleEmails, selectedEmailId],
  );

  const selectedEmailDetail = React.useMemo(
    () => (selectedEmail ? projectEmailToDetailRecord(selectedEmail) : null),
    [selectedEmail],
  );

  const selectedEmailEditable = selectedEmail
    ? canEdit
      ? canEdit(selectedEmail)
      : true
    : false;
  const selectedEmailDeletable = selectedEmail
    ? typeof canDelete === "function"
      ? canDelete(selectedEmail)
      : canDelete
    : false;
  const showAuxiliaryRail = draftFeedbackMode;

  const handleSelectEmail = React.useCallback((email: ProjectEmail) => {
    setSelectedEmailId(email.id);
    setIsDetailsPanelOpen(false);
  }, []);

  // Advance the AI-review queue to the email after the current one, so a
  // reviewer can save-and-continue without leaving the keyboard. Returns false
  // when there is no next email so the panel shows its success confirmation
  // instead of appearing to do nothing on the last item in the queue.
  const handleRequestNextEmail = React.useCallback((): boolean => {
    const index = visibleEmails.findIndex(
      (email) => email.id === selectedEmailId,
    );
    const next = index >= 0 ? visibleEmails[index + 1] : undefined;
    if (!next) return false;
    setSelectedEmailId(next.id);
    setIsDetailsPanelOpen(false);
    return true;
  }, [visibleEmails, selectedEmailId]);

  return (
    <SplitPageFrame
      height="fill"
      className={PROJECT_EMAILS_WORKSPACE_CLASSNAME}
    >
      <SplitPage
        breakpoint="xl"
        defaultIsOpen={!selectedEmail}
        className="min-h-0 flex-1"
      >
        <div
          className={cn(
            "relative flex h-full w-full min-w-0 flex-col overflow-hidden border-b border-border/70 transition-[width] xl:border-b-0 xl:border-r",
            layoutPreference.leftCollapsed
              ? "xl:w-0 xl:border-r-0"
              : "xl:w-[var(--email-left-width)]",
          )}
          style={
            {
              "--email-left-width": `${layoutPreference.leftWidth}px`,
            } as React.CSSProperties
          }
        >
          <div className="border-b border-border/70 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div
                  className={cn(
                    "truncate font-semibold text-foreground",
                    title.length > 12
                      ? "text-[20px] leading-none tracking-[-0.02em]"
                      : "text-2xl tracking-[-0.03em]",
                  )}
                >
                  {title}
                </div>
                {description ? (
                  <div className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleWorkspaceColumn("left")}
                  aria-label="Collapse email list"
                  title="Collapse email list"
                  className="hidden h-8 w-8 rounded-full text-muted-foreground shadow-none xl:inline-flex"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
                {filterControl}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSearchExpanded((current) => !current)}
                  aria-label="Search email"
                  className="h-8 w-8 rounded-full text-muted-foreground shadow-none"
                >
                  <Search className="h-4 w-4" />
                </Button>
                {onSortChange ? (
                  <SortPopover
                    sortBy={sortBy}
                    sortDirection={sortDirection}
                    onSortChange={onSortChange}
                  />
                ) : null}
                {viewSwitcher}
                {canCompose ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onCompose}
                    aria-label="Compose"
                    title="Compose"
                    className="h-8 w-8 rounded-full text-muted-foreground shadow-none"
                  >
                    <Pencil1Icon className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>

            {tabs.length > 0 ? (
              <nav className="mt-3 flex items-center">
                {tabs.map((tab) => (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "relative transition-colors",
                      tab.compact
                        ? "rounded-full px-2.5 py-1 text-[11px] font-medium text-foreground/75 hover:text-foreground/95"
                        : "px-3 py-2 text-sm font-medium",
                      tab.isActive
                        ? "text-primary"
                        : "",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span>{tab.label}</span>
                      {typeof tab.count === "number" ? (
                        <span
                          className={cn(
                            "tabular-nums",
                            tab.compact ? "text-[10px]" : "text-xs",
                          )}
                        >
                          {tab.count}
                        </span>
                      ) : null}
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-colors",
                        tab.isActive ? "bg-primary" : "bg-transparent",
                      )}
                    />
                  </Link>
                ))}
              </nav>
            ) : null}

            <AnimatePresence initial={false}>
              {isSearchExpanded ? (
                <motion.div
                  key="expanded-search"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="relative mt-3">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={searchValue}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder="Search email"
                      className="h-10 rounded-full border-border bg-muted/40 pl-10 pr-10 shadow-none focus-visible:ring-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        onSearchChange("");
                        setIsSearchExpanded(false);
                      }}
                      aria-label="Close search"
                      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-muted-foreground"
                    >
                      <Cross2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <ScrollArea className="min-h-0 min-w-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!min-w-0 [&_[data-slot=scroll-area-viewport]>div]:!w-full">
            {isLoading ? (
              <div className="space-y-1 px-0 py-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="space-y-3 border-l-2 border-transparent px-5 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="px-6 py-10">
                <div className="rounded-3xl border border-red-200 bg-red-50/60 p-5 text-sm text-red-700">
                  <div className="font-semibold text-red-900">
                    Could not load email
                  </div>
                  <p className="mt-2 leading-6">{error.message}</p>
                </div>
              </div>
            ) : visibleEmails.length === 0 ? (
              <div className="px-6 py-10 text-sm text-muted-foreground">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <EnvelopeClosedIcon className="h-5 w-5" />
                </div>
                <div className="mt-5 text-lg font-semibold tracking-[-0.02em] text-foreground">
                  Inbox ready
                </div>
                <p className="mt-2 max-w-xs leading-6">
                  Draft client updates, track incoming messages, and keep
                  project conversations in one quiet workspace.
                </p>
                {canCompose ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCompose}
                    className="mt-6 h-10 rounded-full px-4 shadow-none"
                  >
                    Start a draft
                  </Button>
                ) : null}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="min-w-0 divide-y divide-border/60 overflow-hidden"
              >
                {visibleEmails.map((email) => (
                  <InboxRow
                    key={email.id}
                    email={email}
                    isActive={selectedEmail?.id === email.id}
                    onSelect={() => handleSelectEmail(email)}
                    draftFeedbackMode={draftFeedbackMode}
                  />
                ))}
              </motion.div>
            )}
          </ScrollArea>
          {!layoutPreference.leftCollapsed && isWorkspaceLayoutReady ? (
            <div
              className="group absolute right-0 top-0 hidden h-full w-2 translate-x-1 cursor-col-resize select-none xl:block"
              onMouseDown={handleWorkspaceResizeStart("left")}
              aria-hidden="true"
            >
              <div className="absolute left-1 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
            </div>
          ) : null}
        </div>

        <div className="relative flex h-full min-h-0 min-w-0">
          {layoutPreference.leftCollapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggleWorkspaceColumn("left")}
              aria-label="Expand email list"
              title="Expand email list"
              className="absolute left-2 top-3 z-20 hidden h-8 w-8 rounded-full bg-background/90 text-muted-foreground shadow-none xl:inline-flex"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-h-0 min-w-0 flex-1 border-b border-border/70 xl:border-b-0">
            <EmailReadingPanel
              email={selectedEmail}
              canCompose={canCompose}
              canEditEmail={selectedEmailEditable}
              canDelete={selectedEmailDeletable}
              canProjectEmailActions={selectedEmailEditable}
              onCompose={onCompose}
              onEdit={onEdit}
              onDelete={onDelete}
              showDetailsButton
              onOpenDetails={() => setIsDetailsPanelOpen(true)}
              importanceFeedback={
                selectedEmail
                  ? importanceFeedbackByEmailId[String(selectedEmail.id)] ?? null
                  : null
              }
              onImportanceRecorded={onImportanceRecorded}
              onImportanceCleared={onImportanceCleared}
            />
          </div>

          {showAuxiliaryRail && layoutPreference.rightCollapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggleWorkspaceColumn("right")}
              aria-label="Expand feedback panel"
              title="Expand feedback panel"
              className="absolute right-2 top-3 z-20 hidden h-8 w-8 rounded-full bg-background/90 text-muted-foreground shadow-none xl:inline-flex"
            >
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          ) : null}

          <div
            className={cn(
              "relative hidden min-h-0 shrink-0 overflow-hidden border-l border-border/70 bg-background transition-[width] xl:block",
              !showAuxiliaryRail || layoutPreference.rightCollapsed
                ? "xl:w-0 xl:border-l-0"
                : "xl:w-[var(--email-right-width)]",
            )}
            style={
              {
                "--email-right-width": `${layoutPreference.rightWidth}px`,
              } as React.CSSProperties
            }
          >
            {showAuxiliaryRail &&
            !layoutPreference.rightCollapsed &&
            isWorkspaceLayoutReady ? (
              <>
                <div
                  className="group absolute left-0 top-0 z-20 h-full w-2 -translate-x-1 cursor-col-resize select-none"
                  onMouseDown={handleWorkspaceResizeStart("right")}
                  aria-hidden="true"
                >
                  <div className="absolute left-1 top-0 h-full w-px bg-transparent transition-colors group-hover:bg-primary/50 group-active:bg-primary" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleWorkspaceColumn("right")}
                  aria-label="Collapse feedback panel"
                  title="Collapse feedback panel"
                  className="absolute right-3 top-3 z-20 h-8 w-8 rounded-full bg-background/90 text-muted-foreground shadow-none"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            {showAuxiliaryRail ? (
              AI_REVIEW_PANEL_ENABLED ? (
                <AiReviewPanel
                  selectedEmail={selectedEmail}
                  onSaved={onDraftFeedbackSaved}
                  onRequestNext={handleRequestNextEmail}
                />
              ) : (
                <EmailTrainingFeedbackPanel
                  selectedEmail={selectedEmail}
                  onSaved={onDraftFeedbackSaved}
                />
              )
            ) : null}
          </div>
        </div>
      </SplitPage>

      <EmailDetailSheet
        email={selectedEmailDetail}
        open={isDetailsPanelOpen}
        onOpenChange={setIsDetailsPanelOpen}
        actions={
          selectedEmail ? (
            <div className="flex items-center gap-1">
              {selectedEmailEditable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(selectedEmail)}
                  aria-label="Edit email"
                  className="h-8 w-8"
                >
                  <Pencil1Icon className="h-4 w-4" />
                </Button>
              ) : null}
              {selectedEmailDeletable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(selectedEmail)}
                  aria-label="Delete email"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />
    </SplitPageFrame>
  );
}
