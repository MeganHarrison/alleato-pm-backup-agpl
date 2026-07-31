"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Ban,
  Bot,
  Check,
  ChevronDown,
  Download,
  ArrowRight,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { useProjects } from "@/hooks/use-projects";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import { BRANDON_LEARNING_SUPPRESSION_PREFIX } from "@/lib/email-assistant/brandon-learning";
import { cleanEmailBody } from "./email-body";
import type { InboxEmail } from "./email-inbox-client";
import type {
  BrandonDraftLearning,
  BrandonDraftLearningGuidanceId,
  BrandonDraftLearningGuidanceItem,
} from "@/lib/email-assistant/brandon-learning";
import type { BrandonReviewOutcome } from "@/lib/email-assistant/brandon-review";

const ATTACHMENT_TYPES = [
  "Contract",
  "Proposal",
  "Revised Drawings",
  "Change Order",
  "COI",
  "Invoice",
  "RFI",
  "Submittal",
  "Meeting Minutes",
  "Lien Waiver",
  "Permit",
  "Photo / Site Documentation",
  "Report",
  "Specifications",
  "Correspondence",
  "Other",
] as const;

const EMAIL_TAGS = [
  "Urgent",
  "Action Required",
  "FYI",
  "Finance",
  "Legal",
  "Safety",
  "Waiting on Response",
  "Review Needed",
] as const;

function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(contentType: string | null) {
  if (!contentType) return <Paperclip className="size-3.5" />;
  if (contentType.includes("pdf") || contentType.includes("word"))
    return <FileText className="size-3.5" />;
  return <Paperclip className="size-3.5" />;
}

function AssignProjectPopover({
  email,
  onAssign,
}: {
  email: InboxEmail;
  onAssign: (projectId: number | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { projects, isLoading } = useProjects({ enabled: open });

  async function handleSelect(projectId: number | null) {
    setSaving(true);
    try {
      onAssign(projectId);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const projectLabel = email.project
    ? email.project.projectNumber
      ? `${email.project.projectNumber} — ${email.project.name ?? ""}`
      : (email.project.name ?? `Project ${email.project.id}`)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" disabled={saving}>
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          {projectLabel ?? "Assign to Project"}
          <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search projects…" />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading…" : "No projects found."}
            </CommandEmpty>
            <CommandGroup>
              {email.project && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => handleSelect(null)}
                  className="text-muted-foreground"
                >
                  <X className="size-3.5 mr-2" />
                  Clear assignment
                </CommandItem>
              )}
              {projects?.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.project_number ?? ""} ${p.name ?? ""}`}
                  onSelect={() => handleSelect(p.id)}
                >
                  {p.project_number && (
                    <span className="text-muted-foreground mr-1.5 text-xs">
                      {p.project_number}
                    </span>
                  )}
                  {p.name ?? `Project ${p.id}`}
                  {email.project?.id === p.id && (
                    <Check className="size-3.5 ml-auto text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TagsEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);

  function toggle(tag: string) {
    const next = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground">
          <Tag className="size-3.5" />
          Tag
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start">
        <div className="flex flex-col gap-0.5">
          {EMAIL_TAGS.map((tag) => (
            <Button
              key={tag}
              variant="ghost"
              size="sm"
              onClick={() => toggle(tag)}
              className={cn(
                "flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors h-auto w-full justify-start",
                tags.includes(tag)
                  ? "text-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {tag}
              {tags.includes(tag) && <Check className="size-3 text-primary ml-auto" />}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AttachmentChip({
  attachment,
  emailId,
}: {
  attachment: InboxEmail["attachments"][number];
  emailId: number;
}) {
  const [type, setType] = React.useState<string | null>(
    attachment.attachmentType ?? null,
  );
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  async function handleTypeSelect(selected: string) {
    setSaving(true);
    try {
      await apiFetch(`/api/email-inbox/attachments/${attachment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachmentType: selected }),
      });
      setType(selected);
    } catch {
      toast.error("Failed to set attachment type");
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  function handleDownload() {
    window.open(
      `/api/outlook-intake/attachments/${attachment.id}/download`,
      "_blank",
    );
  }

  return (
    <div className="group rounded-lg bg-muted/60 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{fileIcon(attachment.contentType)}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium text-foreground truncate max-w-36">
          {attachment.fileName}
        </span>
        {attachment.fileSize && (
          <span className="text-[10px] text-muted-foreground leading-none">
            {fileSizeLabel(attachment.fileSize)}
          </span>
        )}
      </div>

      {/* Type selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-[10px] gap-1 rounded-md border",
              type
                ? "border-primary/30 text-primary bg-primary/5"
                : "border-border/50 text-muted-foreground",
            )}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <>
                {type ?? "Type"}
                <ChevronDown className="size-2.5" />
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          <div className="flex flex-col gap-0.5">
            {ATTACHMENT_TYPES.map((t) => (
              <Button
                key={t}
                variant="ghost"
                size="sm"
                onClick={() => handleTypeSelect(t)}
                className={cn(
                  "h-auto w-full justify-start px-2.5 py-1.5 text-xs",
                  type === t ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {t}
                {type === t && <Check className="size-3 text-primary ml-auto" />}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleDownload}
        aria-label="Download"
      >
        <Download className="size-3.5" />
      </Button>
      </div>
    </div>
  );
}

const ASSISTANT_ACTION_LABEL: Record<InboxEmail["assistantAction"], string> = {
  reply: "Reply",
  delegate: "Delegate",
  watch: "Watch",
  ignore: "No action",
};

function AssistantDecisionLine({ email }: { email: InboxEmail }) {
  if (email.assistantAction === "ignore") return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-medium text-foreground">
          {ASSISTANT_ACTION_LABEL[email.assistantAction]}
        </span>
        <span className="text-muted-foreground">{email.assistantReason}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Owner: {email.assistantOwner}. Risk: {email.assistantRisk}.
      </p>
    </div>
  );
}

function DraftReplyPanel({
  email,
  onClose,
  onRecordReview,
}: {
  email: InboxEmail;
  onClose: () => void;
  onRecordReview: (
    outcome: BrandonReviewOutcome,
    draftBody?: string | null,
    reviewerNote?: string | null,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState("");
  const [learning, setLearning] = React.useState<BrandonDraftLearning | null>(null);
  const [suppressedGuidanceIds, setSuppressedGuidanceIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = React.useState(true);
  const [tone, setTone] = React.useState<"professional" | "concise" | "detailed">(
    "professional",
  );
  const initialDraftRef = React.useRef<string | null>(null);

  async function fetchDraft(selectedTone = tone) {
    setLoading(true);
    try {
      const result = await apiFetch<{
        draft: string;
        learning?: BrandonDraftLearning;
      }>(
        `/api/email-inbox/${email.id}/draft-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: email.subject,
            fromName: email.fromName,
            fromEmail: email.fromEmail,
            bodyText: email.bodyText ?? email.body,
            projectName: email.project?.name ?? null,
            tone: selectedTone,
          }),
        },
      );
      setDraft(result.draft);
      setLearning(result.learning ?? null);
      setSuppressedGuidanceIds(new Set());
      initialDraftRef.current = result.draft;
    } catch {
      toast.error("Failed to generate draft — check AI configuration.");
      setDraft("");
    } finally {
      setLoading(false);
    }
  }

  // Fetch initial draft on mount only; tone changes are triggered explicitly
  const hasFetchedRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      void fetchDraft();
    }
  });

  async function handleSend() {
    if (email.webLink) {
      window.open(email.webLink, "_blank");
    }
    navigator.clipboard.writeText(draft).catch(() => {});
    const outcome =
      initialDraftRef.current?.trim() === draft.trim()
        ? "draft_copied"
        : "draft_edited";

    try {
      await onRecordReview(outcome, draft);
      toast.success("Draft copied and review recorded.");
      onClose();
    } catch {
      toast.error("Draft copied, but the review outcome was not recorded.");
    }
  }

  async function handleSuppressLearning(item: BrandonDraftLearningGuidanceItem) {
    try {
      await onRecordReview(
        "marked_no_action",
        null,
        `${BRANDON_LEARNING_SUPPRESSION_PREFIX} id=${item.id}; text=${item.text}`,
      );
      setSuppressedGuidanceIds((current) => new Set(current).add(item.id));
      toast.success("Learning correction recorded.");
    } catch (error) {
      toast.error("Failed to record learning correction.", {
        description:
          error instanceof Error ? error.message : "Unknown review ledger error.",
      });
    }
  }

  const guidanceItems =
    learning?.guidanceItems ??
    learning?.guidance.map((text) => ({
      // Fallback display items have no canonical guidance id; the text itself is
      // a stable key for React + the suppression set (compared as strings).
      id: text as BrandonDraftLearningGuidanceId,
      text,
    })) ??
    [];
  const visibleGuidance =
    guidanceItems
      .filter((item) => !suppressedGuidanceIds.has(item.id))
      .slice(0, 3);

  return (
    <div className="border-t border-border/50 bg-card flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-primary" />
          <span className="text-sm font-medium">AI Draft Reply</span>
          <div className="flex items-center gap-1 ml-2">
            {(["professional", "concise", "detailed"] as const).map((t) => (
              <Button
                key={t}
                variant={tone === t ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setTone(t);
                  void fetchDraft(t);
                }}
                className="h-6 px-2 text-xs capitalize"
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7 text-muted-foreground"
            onClick={() => void fetchDraft()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Regenerate
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 p-3">
        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" />
            Drafting reply…
          </div>
        ) : (
          <div className="space-y-2">
            {learning && visibleGuidance.length > 0 && (
              <div className="space-y-1 border-b border-border/30 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-foreground">
                    Learning applied
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {learning.reviewCount} reviews
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {visibleGuidance.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 text-[11px] leading-relaxed text-muted-foreground"
                    >
                      <span>{item.text}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 shrink-0 px-1.5 text-[10px] text-muted-foreground"
                        onClick={() => void handleSuppressLearning(item)}
                      >
                        Not right
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-32 text-sm resize-none border-border/40 bg-background focus-visible:ring-primary/20"
              placeholder="Draft will appear here…"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 pb-3">
        <p className="text-[11px] text-muted-foreground">
          Review before sending. Opens Outlook when ready.
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>
            Discard
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSend}
            disabled={loading || !draft}
          >
            <Send className="size-3.5" />
            Copy &amp; Open in Outlook
          </Button>
        </div>
      </div>
    </div>
  );
}

type FilterRuleScope = "domain" | "sender" | "subject";
type FilterRuleAction = "skip" | "review";

/**
 * "Ignore like this" — turns the open email into a reusable `email_filter_rules`
 * row so future emails from the same sender/domain (or matching a subject phrase)
 * are dropped or flagged at ingestion. Admin-only: the API enforces it, and the
 * trigger is hidden for non-admins.
 */
function IgnoreLikeThisPopover({ email }: { email: InboxEmail }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fromEmail = email.fromEmail?.trim().toLowerCase() || null;
  const domain =
    fromEmail && fromEmail.includes("@") ? fromEmail.split("@")[1] : null;

  const [scope, setScope] = React.useState<FilterRuleScope>(
    domain ? "domain" : "subject",
  );
  const [subjectContains, setSubjectContains] = React.useState("");
  const [action, setAction] = React.useState<FilterRuleAction>("skip");

  // Reset the form whenever a different email is opened.
  React.useEffect(() => {
    setScope(domain ? "domain" : "subject");
    setSubjectContains("");
    setAction("skip");
  }, [email.id, domain]);

  const subject = subjectContains.trim();
  const canCreate =
    (scope === "domain" && Boolean(domain)) ||
    (scope === "sender" && Boolean(fromEmail)) ||
    (scope === "subject" && subject.length > 0);

  const scopeOptions: { id: FilterRuleScope; label: string; disabled?: boolean }[] = [
    { id: "domain", label: domain ? `Anyone @${domain}` : "Sender domain", disabled: !domain },
    { id: "sender", label: fromEmail ? `Only ${fromEmail}` : "This address", disabled: !fromEmail },
    { id: "subject", label: "Any sender (subject only)" },
  ];

  async function handleCreate() {
    if (!canCreate) return;
    setSaving(true);

    const matchLabel =
      scope === "domain" && domain
        ? `@${domain}`
        : scope === "sender" && fromEmail
          ? fromEmail
          : "subject match";
    const label = `Ignore ${matchLabel}${subject ? ` · "${subject}"` : ""}`.slice(0, 120);

    const payload: Record<string, string> = {
      action,
      label,
      sourceMessageId: email.graphMessageId,
      sourceSubject: email.subject,
    };
    if (scope === "domain" && domain) payload.senderDomain = domain;
    if (scope === "sender" && fromEmail) payload.senderPattern = fromEmail;
    if (subject) payload.subjectPattern = `%${subject}%`;

    try {
      await apiFetch("/api/email-filter-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success(
        action === "skip"
          ? "Filter rule created — future emails like this won't be imported."
          : "Filter rule created — future emails like this will be flagged for review.",
      );
      setOpen(false);
    } catch (error) {
      toast.error("Failed to create filter rule.", {
        description:
          error instanceof Error ? error.message : "Unknown filter-rule error.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
        >
          <Ban className="size-3.5" />
          Ignore like this
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <p className="text-xs font-medium text-foreground">
          Stop importing emails like this
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Applies to future syncs, not emails already imported.
        </p>

        <div className="mt-3 flex flex-col gap-0.5">
          {scopeOptions.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              variant="ghost"
              size="sm"
              disabled={opt.disabled}
              onClick={() => setScope(opt.id)}
              className={cn(
                "h-auto w-full justify-start px-2.5 py-1.5 text-xs",
                scope === opt.id ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {opt.label}
              {scope === opt.id && <Check className="size-3 text-primary ml-auto" />}
            </Button>
          ))}
        </div>

        <div className="mt-2">
          <Input
            value={subjectContains}
            onChange={(e) => setSubjectContains(e.target.value)}
            placeholder={
              scope === "subject"
                ? "Subject contains… (required)"
                : "Subject contains… (optional)"
            }
            className="h-8 text-xs"
          />
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground mr-1">Then</span>
          {(["skip", "review"] as const).map((a) => (
            <Button
              key={a}
              type="button"
              variant={action === a ? "default" : "outline"}
              size="sm"
              onClick={() => setAction(a)}
              className="h-7 px-2.5 text-xs"
            >
              {a === "skip" ? "Skip entirely" : "Flag for review"}
            </Button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => void handleCreate()}
            disabled={!canCreate || saving}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Create rule
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface EmailReadingPaneProps {
  email: InboxEmail | null;
  draftReplyOpen: boolean;
  onDraftReplyOpen: () => void;
  onDraftReplyClose: () => void;
  onAssignProject: (projectId: number | null) => void;
  onToggleStar: () => void;
  onTagsChange: (tags: string[]) => void;
  reviewSaving: boolean;
  onRecordReview: (
    outcome: BrandonReviewOutcome,
    draftBody?: string | null,
    reviewerNote?: string | null,
  ) => Promise<void>;
}

export function EmailReadingPane({
  email,
  draftReplyOpen,
  onDraftReplyOpen,
  onDraftReplyClose,
  onAssignProject,
  onToggleStar,
  onTagsChange,
  reviewSaving,
  onRecordReview,
}: EmailReadingPaneProps) {
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const { profile } = useCurrentUserProfile();
  const isAdmin = profile?.isAdmin ?? false;

  React.useEffect(() => {
    setSummaryOpen(false);
    setSummary(null);
  }, [email?.id]);

  async function handleSummarize() {
    if (!email) return;
    setSummaryOpen(true);
    if (summary) return;
    setSummaryLoading(true);
    try {
      const result = await apiFetch<{ draft: string }>(
        `/api/email-inbox/${email.id}/draft-reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: email.subject,
            fromName: email.fromName,
            fromEmail: email.fromEmail,
            bodyText: `Summarize this email in 1-2 sentences: ${email.bodyText ?? email.body ?? ""}`,
            tone: "concise",
          }),
        },
      );
      setSummary(result.draft);
    } catch {
      setSummary("Could not generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleRecordReview(outcome: BrandonReviewOutcome) {
    try {
      await onRecordReview(outcome);
      toast.success("Review recorded.");
    } catch (error) {
      toast.error("Failed to record review outcome.", {
        description:
          error instanceof Error ? error.message : "Unknown review ledger error.",
      });
    }
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
        <Mail className="size-10" />
        <p className="text-sm">Select an email to read</p>
        <p className="text-xs text-muted-foreground/40">
          Use <kbd className="font-mono text-[10px]">j</kbd> /{" "}
          <kbd className="font-mono text-[10px]">k</kbd> to navigate
        </p>
      </div>
    );
  }

  const dateStr = email.receivedAt
    ? format(new Date(email.receivedAt), "MMM d, yyyy 'at' h:mm a")
    : null;
  const toStr = (email.toList ?? []).join(", ");
  const ccStr = (email.ccList ?? []).join(", ");

  return (
    <div className="flex flex-col h-full">
      {/* Email header */}
      <div className="px-6 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <p className="text-base font-semibold text-foreground leading-snug flex-1">
            {email.subject}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onToggleStar}
              aria-label={email.starred ? "Unstar" : "Star"}
            >
              <Star
                className={cn(
                  "size-4",
                  email.starred
                    ? "fill-warning text-warning"
                    : "text-muted-foreground",
                )}
              />
            </Button>
            {email.webLink && (
              <Button variant="ghost" size="icon" className="size-8" asChild>
                <a
                  href={email.webLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in Outlook"
                >
                  <ArrowRight className="size-4 text-muted-foreground" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Metadata */}
        <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <dt className="font-medium text-foreground/60 w-8 shrink-0">From</dt>
            <dd>
              {email.fromName ? (
                <>
                  <span className="text-foreground">{email.fromName}</span>{" "}
                  {email.fromEmail && (
                    <span className="text-muted-foreground">
                      &lt;{email.fromEmail}&gt;
                    </span>
                  )}
                </>
              ) : (
                email.fromEmail ?? "Unknown"
              )}
            </dd>
          </div>
          {toStr && (
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/60 w-8 shrink-0">To</dt>
              <dd className="truncate">{toStr}</dd>
            </div>
          )}
          {ccStr && (
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/60 w-8 shrink-0">Cc</dt>
              <dd className="truncate">{ccStr}</dd>
            </div>
          )}
          {dateStr && (
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/60 w-8 shrink-0">Date</dt>
              <dd>{dateStr}</dd>
            </div>
          )}
          {email.project && (
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/60 w-8 shrink-0">Proj</dt>
              <dd className="text-primary">
                {email.project.projectNumber
                  ? `${email.project.projectNumber} — ${email.project.name ?? ""}`
                  : (email.project.name ?? `Project ${email.project.id}`)}
              </dd>
            </div>
          )}
        </dl>

        {/* Tags */}
        {email.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {email.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-info-subtle text-info font-medium"
              >
                {tag}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onTagsChange(email.tags.filter((t) => t !== tag))
                  }
                  className="size-3.5 hover:opacity-70 ml-0.5 p-0 h-auto"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="size-2.5" />
                </Button>
              </span>
            ))}
          </div>
        )}

        <AssistantDecisionLine email={email} />
      </div>

      {/* AI Summary banner */}
      {summaryOpen && (
        <div className="px-6 py-3 border-b border-border/30 bg-muted/30 shrink-0">
          <div className="flex items-start gap-2">
            <Sparkles className="size-3.5 text-primary mt-0.5 shrink-0" />
            {summaryLoading ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" /> Summarizing…
              </span>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                {summary}
              </p>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSummaryOpen(false)}
              className="size-6 text-muted-foreground shrink-0"
              aria-label="Close summary"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Email body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
        {email.bodyHtml ? (
          <div
            className="prose prose-sm max-w-none text-foreground [&_a]:text-primary"
            // We render sanitized HTML; the API strips unsafe tags via the DB text pipeline
            dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
          />
        ) : email.bodyText ? (
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {cleanEmailBody(email.bodyText)}
          </pre>
        ) : email.body ? (
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {cleanEmailBody(email.body)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">(No body content)</p>
        )}
      </div>

      {/* Attachments strip */}
      {email.attachments.length > 0 && (
        <div className="px-6 py-3 border-t border-border/30 shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Paperclip className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {email.attachments.length}{" "}
              {email.attachments.length === 1 ? "Attachment" : "Attachments"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {email.attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                attachment={att}
                emailId={email.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="px-4 py-3 border-t border-border/40 shrink-0 flex items-center gap-1.5 flex-wrap">
        <Button
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={onDraftReplyOpen}
          disabled={draftReplyOpen}
        >
          <Bot className="size-3.5" />
          {email.assistantAction === "reply" ? "Draft Brandon Reply" : "Draft Reply"}
        </Button>

        <AssignProjectPopover email={email} onAssign={onAssignProject} />

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
          onClick={handleSummarize}
        >
          <Sparkles className="size-3.5" />
          Summarize
        </Button>

        <TagsEditor tags={email.tags} onChange={onTagsChange} />

        {isAdmin && <IgnoreLikeThisPopover email={email} />}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground"
              disabled={reviewSaving}
            >
              <Check className="size-3.5" />
              Record
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => void handleRecordReview("delegated")}>
              Delegated
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleRecordReview("watched")}>
              Watching
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void handleRecordReview("skipped")}>
              Skipped
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void handleRecordReview("marked_no_action")}
            >
              No action
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {email.webLink && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-foreground ml-auto"
            asChild
          >
            <a href={email.webLink} target="_blank" rel="noopener noreferrer">
              <ArrowRight className="size-3.5" />
              Open in Outlook
            </a>
          </Button>
        )}
      </div>

      {/* Draft reply compose area */}
      {draftReplyOpen && (
        <DraftReplyPanel
          email={email}
          onClose={onDraftReplyClose}
          onRecordReview={onRecordReview}
        />
      )}
    </div>
  );
}
