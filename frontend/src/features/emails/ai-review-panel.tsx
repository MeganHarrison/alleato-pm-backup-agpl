"use client";

/**
 * AI Review panel — "Confirm & Correct" (design option 1a).
 *
 * A calm, plain-English summary of the AI's plan for an incoming email. Most
 * classifications are already right, so a single tap saves feedback; any one
 * decision can be corrected inline before saving. This replaces the older
 * "AI Classification" verdict list (`EmailTrainingFeedbackPanel`), which is kept
 * in `project-emails-workspace.tsx` behind {@link AI_REVIEW_PANEL_ENABLED} so the
 * previous panel can be restored by flipping a single flag.
 *
 * State per email tracks, for each of the four decisions, a `{ value, status }`
 * pair where status ∈ unreviewed | confirmed | corrected. On save, any still
 * unreviewed decision is treated as confirmed, mapped onto the existing
 * assistant-review contract (`fieldFeedback` verdicts + `projectAssignment`), and
 * persisted through the same endpoints the legacy panel used.
 */

import * as React from "react";
import {
  Check,
  ChevronDown,
  ArrowRight,
  ListFilter,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ProjectEmail } from "@/hooks/use-emails";
import { useProjects, type Project } from "@/hooks/use-projects";
import {
  buildAssistantReviewPayload,
  verdictToStatus,
  type DecisionStatus,
  type ReplyFeedback,
  type ReviewAction,
  type ReviewPriority,
} from "./ai-review-payload";
import { InboxRuleDialog } from "./inbox-rule-dialog";

/** Owner/Brandon-gated page listing every inbox rule (opened in a new tab). */
const INBOX_RULES_PAGE = "/outlook-draft-feedback/rules";

/**
 * Feature flag for the redesigned "Confirm & Correct" AI Review panel.
 *
 * Flip to `false` to instantly restore the previous `EmailTrainingFeedbackPanel`
 * ("AI Classification" verdict list) at every call site — no other change needed.
 */
export const AI_REVIEW_PANEL_ENABLED = true;

const ACTION_OPTIONS: { value: ReviewAction; label: string }[] = [
  { value: "reply", label: "Reply" },
  { value: "delegate", label: "Delegate" },
  { value: "watch", label: "Watch" },
  { value: "ignore", label: "Archive" },
];

const PRIORITY_OPTIONS: { value: ReviewPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS = [
  "Meeting Notes",
  "Accounting",
  "Client Follow-up",
  "Sales Lead",
  "Vendor / Subcontractor",
  "Internal Coordination",
  "Scheduling",
  "No Action",
] as const;

const REPLY_OPTIONS: { value: ReplyFeedback; label: string }[] = [
  { value: "good", label: "Looks good" },
  { value: "edit", label: "Edit" },
  { value: "regen", label: "Regenerate" },
  { value: "skip", label: "Not needed" },
];

function actionLabel(value: ReviewAction): string {
  return ACTION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function priorityLabel(value: ReviewPriority): string {
  return (
    PRIORITY_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function defaultAssistantCategory(email: ProjectEmail): string {
  if (email.assistant_category?.trim()) return email.assistant_category.trim();
  switch (email.assistant_action) {
    case "reply":
      return "Client Follow-up";
    case "delegate":
      return "Vendor / Subcontractor";
    case "watch":
      return "Internal Coordination";
    case "ignore":
      return "No Action";
    default:
      return "Meeting Notes";
  }
}

function formatProjectOption(project: Project): string {
  return project.project_number
    ? `${project.project_number} - ${project.name ?? `Project ${project.id}`}`
    : (project.name ?? `Project ${project.id}`);
}

function projectLabel(project: ProjectEmail["project"] | null | undefined): string {
  if (!project) return "No project assigned";
  if (project.project_number && project.name)
    return `${project.project_number} - ${project.name}`;
  return project.name || project.project_number || `Project ${project.id}`;
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

const STATUS_CHIP_CLASS: Record<DecisionStatus, string> = {
  confirmed: "bg-status-success/10 text-status-success",
  // A correction is the one thing that changed against the AI's call, so it
  // reads in red (with the original value struck through in red too). This chip
  // only renders for a genuine correction.
  corrected: "bg-destructive/10 text-destructive",
  unreviewed: "bg-muted text-muted-foreground",
};

const STATUS_CHIP_LABEL: Record<DecisionStatus, string> = {
  confirmed: "Confirmed",
  corrected: "Corrected",
  unreviewed: "Review",
};

function StatusChip({ status }: { status: DecisionStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]",
        STATUS_CHIP_CLASS[status],
      )}
    >
      {STATUS_CHIP_LABEL[status]}
    </span>
  );
}

/** Wrapping option chips used to correct action / priority / category inline. */
function OptionChips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { value: T; label: string }[];
  value: T;
  onPick: (next: T) => void;
}) {
  return (
    <div className="ml-8 mt-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPick(option.value)}
            className={cn(
              "h-auto rounded-lg px-3 py-1.5 text-xs font-medium shadow-none",
              selected
                ? "border-foreground bg-foreground/10 text-foreground hover:bg-foreground/10 hover:text-foreground"
                : "border-border bg-background text-muted-foreground",
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

interface DecisionRowProps {
  /** 1–4 number badge — self-documents the (future) keyboard shortcut. */
  num: number;
  label: string;
  value: string;
  aiValue: string | null;
  status: DecisionStatus;
  isEditing: boolean;
  onToggleEdit: () => void;
  /** Per-row reasoning expander. */
  whyOpen: boolean;
  onToggleWhy: () => void;
  why: string;
  editor: React.ReactNode;
}

function DecisionRow({
  num,
  label,
  value,
  aiValue,
  status,
  isEditing,
  onToggleEdit,
  whyOpen,
  onToggleWhy,
  why,
  editor,
}: DecisionRowProps) {
  const corrected = status === "corrected";
  const showStrikethrough = corrected && aiValue !== null && aiValue !== value;

  return (
    <div className="border-b border-border/60 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {label}
          </div>
          {/* Value line — a correction keeps the AI's original struck through. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-foreground">
              {value}
            </span>
            {showStrikethrough ? (
              <span className="text-[11.5px] font-medium text-destructive line-through">
                {aiValue}
              </span>
            ) : null}
          </div>
        </div>
        {/* The status tag only appears for a genuine correction — an unchanged
            row would otherwise show a "Review" chip on every field, which is
            pure noise since every field defaults to review. */}
        {corrected ? <StatusChip status={status} /> : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleEdit}
          aria-expanded={isEditing}
          className="h-auto shrink-0 px-0 py-0 text-[12px] font-semibold text-primary hover:bg-transparent hover:text-primary hover:underline"
        >
          {isEditing ? "Close" : "Change"}
        </Button>
      </div>

      {isEditing ? editor : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggleWhy}
        aria-expanded={whyOpen}
        className="ml-8 mt-0 block h-auto px-0 py-1 text-[11.5px] font-medium text-muted-foreground/80 hover:bg-transparent hover:text-foreground"
      >
        {whyOpen ? "Hide reason" : "Why the AI chose this"}
      </Button>
      {whyOpen ? (
        <div className="ml-8 mt-1.5 rounded-lg bg-muted px-3 py-2.5 text-[12px] leading-[1.55] text-muted-foreground">
          {why}
        </div>
      ) : null}
    </div>
  );
}

const SECTION_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground";

export interface AiReviewPanelProps {
  selectedEmail: ProjectEmail | null;
  className?: string;
  onSaved?: () => void;
  /**
   * Advance to the next email in the list. When provided, the panel exposes a
   * "Save & next" action and an Enter keyboard shortcut so a reviewer can fly
   * through a large pending queue without reaching for the mouse. Returns `true`
   * if it actually advanced, or `false` when there is no next email — in which
   * case the panel falls back to showing the "Feedback saved" confirmation so
   * the last item in a queue never looks like a silent no-op.
   */
  onRequestNext?: () => boolean;
}

export function AiReviewPanel({
  selectedEmail,
  className,
  onSaved,
  onRequestNext,
}: AiReviewPanelProps) {
  const { projects, isLoading: projectsLoading } = useProjects({ limit: 250 });

  // AI's original picks, captured from the email so corrections can show the
  // struck-through original beside the new value.
  const aiValues = React.useMemo(() => {
    if (!selectedEmail) {
      return {
        action: "watch" as ReviewAction,
        priority: "normal" as ReviewPriority,
        category: "Meeting Notes",
        projectId: null as number | null,
      };
    }
    return {
      action: (selectedEmail.assistant_action ?? "watch") as ReviewAction,
      priority: (selectedEmail.assistant_priority ?? "normal") as ReviewPriority,
      category: defaultAssistantCategory(selectedEmail),
      projectId:
        typeof selectedEmail.project_id === "number"
          ? selectedEmail.project_id
          : null,
    };
  }, [selectedEmail]);

  const [action, setAction] = React.useState<ReviewAction>("watch");
  const [priority, setPriority] = React.useState<ReviewPriority>("normal");
  const [category, setCategory] = React.useState("Meeting Notes");
  const [projectId, setProjectId] = React.useState<number | null>(null);
  const [status, setStatus] = React.useState<{
    action: DecisionStatus;
    priority: DecisionStatus;
    project: DecisionStatus;
    category: DecisionStatus;
  }>({
    action: "unreviewed",
    priority: "unreviewed",
    project: "unreviewed",
    category: "unreviewed",
  });
  const [openEditor, setOpenEditor] = React.useState<
    "action" | "priority" | "project" | "category" | null
  >(null);
  const [whyOpen, setWhyOpen] = React.useState<{
    action: boolean;
    priority: boolean;
    project: boolean;
    category: boolean;
  }>({ action: false, priority: false, project: false, category: false });
  const [projectPickerOpen, setProjectPickerOpen] = React.useState(false);

  const [replyFeedback, setReplyFeedback] =
    React.useState<ReplyFeedback | null>(null);
  const [draftBody, setDraftBody] = React.useState("");
  const [isEditingDraft, setIsEditingDraft] = React.useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = React.useState(false);

  const [submitted, setSubmitted] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (!selectedEmail) return;
    const review = selectedEmail.assistant_review;
    const fieldFeedback = review?.fieldFeedback;

    setAction(aiValues.action);
    setPriority(aiValues.priority);
    // A prior correction stores the reviewer's category on the review row while
    // the email keeps the AI's original — surface the corrected one if present.
    setCategory(
      fieldFeedback?.category === "incorrect" && review?.assistantCategory?.trim()
        ? review.assistantCategory.trim()
        : aiValues.category,
    );
    setProjectId(aiValues.projectId);
    setStatus({
      action: verdictToStatus(fieldFeedback?.action),
      priority: verdictToStatus(fieldFeedback?.priority),
      project: verdictToStatus(fieldFeedback?.project),
      category: verdictToStatus(fieldFeedback?.category),
    });
    setOpenEditor(null);
    setWhyOpen({ action: false, priority: false, project: false, category: false });
    setDraftBody(review?.draftBody ?? "");
    // Only reflect an explicit prior verdict on the reply — never pre-approve a
    // draft the reviewer hasn't looked at (or one that doesn't exist yet).
    setReplyFeedback(
      review?.reviewOutcome === "draft_copied"
        ? "good"
        : review?.reviewOutcome === "draft_edited"
          ? "edit"
          : review?.reviewOutcome === "marked_no_action"
            ? "skip"
            : null,
    );
    setIsEditingDraft(false);
    setSubmitted(false);
    setSavedAt(review?.feedbackProvidedAt ?? null);
  }, [selectedEmail, aiValues]);

  const projectDisplayLabel = React.useCallback(
    (id: number | null): string => {
      if (id === null) return "No project assigned";
      const match = projects.find((project) => project.id === id);
      if (match) return formatProjectOption(match);
      if (selectedEmail?.project && selectedEmail.project.id === id) {
        return projectLabel(selectedEmail.project);
      }
      return `Project ${id}`;
    },
    [projects, selectedEmail],
  );

  const pickValue = React.useCallback(
    (
      key: "action" | "priority" | "category",
      next: string,
      aiValue: string,
    ) => {
      if (key === "action") setAction(next as ReviewAction);
      if (key === "priority") setPriority(next as ReviewPriority);
      if (key === "category") setCategory(next);
      setStatus((current) => ({
        ...current,
        [key]: next === aiValue ? "confirmed" : "corrected",
      }));
      setOpenEditor(null);
    },
    [],
  );

  const pickProject = React.useCallback(
    (id: number | null) => {
      setProjectId(id);
      setStatus((current) => ({
        ...current,
        project: id === aiValues.projectId ? "confirmed" : "corrected",
      }));
      setProjectPickerOpen(false);
      setOpenEditor(null);
    },
    [aiValues.projectId],
  );

  const toggleEditor = React.useCallback(
    (key: "action" | "priority" | "project" | "category") => {
      setOpenEditor((current) => (current === key ? null : key));
    },
    [],
  );

  const toggleWhy = React.useCallback(
    (key: "action" | "priority" | "project" | "category") => {
      setWhyOpen((current) => ({ ...current, [key]: !current[key] }));
    },
    [],
  );

  const counts = React.useMemo(() => {
    const values = Object.values(status);
    return {
      confirmed: values.filter((value) => value === "confirmed").length,
      corrected: values.filter((value) => value === "corrected").length,
    };
  }, [status]);

  const whyText = React.useMemo(() => {
    if (!selectedEmail) {
      return { action: "", priority: "", project: "", category: "" };
    }
    const reason = selectedEmail.assistant_reason?.trim();
    const rules = selectedEmail.assistant_rules_applied ?? [];
    const rulesLine = rules.length
      ? `Rules applied: ${rules.join(", ")}.`
      : "";
    const score =
      typeof selectedEmail.assistant_score === "number"
        ? Math.round(selectedEmail.assistant_score)
        : null;

    return {
      action:
        reason ||
        "Routed from the sender, recipients, and whether a question or task is directed at you.",
      priority: [
        score !== null ? `Confidence score ${score}.` : "",
        selectedEmail.assistant_risk?.trim() || "",
        // Only nudge about over-flagging when the AI actually raised the flag —
        // for a low/normal pick this line would read as a non-sequitur.
        aiValues.priority === "urgent" || aiValues.priority === "high"
          ? "Same-day or meeting-related messages are often over-flagged — a good one to correct."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      project:
        aiValues.projectId === null
          ? "No project code or known keyword was found in the subject or body."
          : "Matched from the project keyword or existing project context.",
      category:
        rulesLine ||
        "Derived from the subject line, message body, and any attachments.",
    };
  }, [selectedEmail, aiValues.projectId, aiValues.priority]);

  function handleReplyFeedback(next: ReplyFeedback) {
    if (next === "regen") {
      void handleGenerateDraft();
      return;
    }
    setReplyFeedback(next);
    setIsEditingDraft(next === "edit");
  }

  async function handleGenerateDraft() {
    if (!selectedEmail) return;
    setReplyFeedback("regen");
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
      setReplyFeedback("edit");
      setIsEditingDraft(true);
      toast.success("Draft generated.");
    } catch (error) {
      console.error("Could not generate the suggested reply.", error);
      toast.error("Could not generate the reply. Check AI configuration.");
      setReplyFeedback(null);
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  async function handleSaveAll({ advance = false }: { advance?: boolean } = {}) {
    if (!selectedEmail || isSaving) return;

    const finalStatus = {
      action: status.action === "unreviewed" ? "confirmed" : status.action,
      priority: status.priority === "unreviewed" ? "confirmed" : status.priority,
      project: status.project === "unreviewed" ? "confirmed" : status.project,
      category: status.category === "unreviewed" ? "confirmed" : status.category,
    } as const;

    // Payload construction lives in the pure, unit-tested `ai-review-payload`
    // module (see ai-review-payload.unit.test.ts) — the projectAssignment
    // omission and verdict-mapping logic is the exact class of bug a review
    // caught here.
    const payload = buildAssistantReviewPayload({
      action,
      priority,
      category,
      projectId,
      finalStatus,
      replyFeedback,
      draftBody,
    });

    setIsSaving(true);
    try {
      if (selectedEmail.assistant_review?.reviewId) {
        await apiFetch("/api/email-inbox/reviewed", {
          method: "PATCH",
          body: JSON.stringify({
            reviewId: selectedEmail.assistant_review.reviewId,
            ...payload,
          }),
        });
      } else {
        await apiFetch(`/api/email-inbox/${selectedEmail.id}/assistant-review`, {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            assistantScore: selectedEmail.assistant_score ?? null,
            assistantReason: selectedEmail.assistant_reason ?? null,
            assistantOwner: selectedEmail.assistant_owner ?? null,
            assistantRisk: selectedEmail.assistant_risk ?? null,
            assistantEvidence: selectedEmail.assistant_evidence ?? null,
          }),
        });
      }

      setStatus(finalStatus);
      setSavedAt(new Date().toISOString());
      toast.success("Feedback saved for AI training.");
      onSaved?.();
      // Fly through the queue: jump straight to the next email instead of
      // parking on the success card (the panel re-initializes on select). If
      // there is no next email (end of the queue), onRequestNext returns false
      // and we fall back to the success card so the save is never a silent no-op.
      const advanced = advance && onRequestNext ? onRequestNext() : false;
      if (!advanced) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Could not save AI review feedback.", error);
      toast.error("Could not save feedback. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // Keep a ref to the latest save handler so the keyboard effect can call it
  // without re-subscribing on every state change (and without stale closures).
  const saveRef = React.useRef(handleSaveAll);
  React.useEffect(() => {
    saveRef.current = handleSaveAll;
  });

  // Keyboard: Enter saves (and advances when a queue is available); Escape
  // closes an open inline editor. Ignored while typing in a field OR while focus
  // is on an interactive control (a chip, the reasoning toggle, the project
  // picker, the reply buttons…) so Enter activates that control instead of
  // prematurely persisting the review.
  React.useEffect(() => {
    if (!selectedEmail || submitted) return;
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      const onInteractiveControl = target?.closest(
        'button, a, select, [role="button"], [role="combobox"], [role="menuitem"], [role="menuitemradio"], [role="option"]',
      );
      if (event.key === "Enter" && !event.shiftKey && !onInteractiveControl) {
        event.preventDefault();
        void saveRef.current({ advance: Boolean(onRequestNext) });
      } else if (event.key === "Escape" && openEditor) {
        event.preventDefault();
        setOpenEditor(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEmail, submitted, openEditor, onRequestNext]);

  if (!selectedEmail) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center px-8 text-center",
          className,
        )}
      >
        <Sparkles className="h-6 w-6 text-muted-foreground" />
        <div className="mt-3 text-sm font-semibold text-foreground">
          AI Review
        </div>
        <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
          Select an email to confirm what the AI decided — or fix anything it got
          wrong.
        </p>
      </div>
    );
  }

  const draftText = draftBody.trim();
  // Only surface the reply block when a reply is actually in play — an empty
  // reply card under a "Delegate"/"Watch"/"Archive" decision is pure noise.
  const needsReply = action === "reply" || Boolean(draftText);
  const replyOptions = REPLY_OPTIONS.map((option) =>
    option.value === "regen"
      ? { ...option, label: draftText ? "Regenerate" : "Generate" }
      : option,
  );

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex flex-col gap-0.5 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[15px] font-semibold text-primary">
            AI Review
          </span>
        </div>
        <span className="text-[12.5px] text-muted-foreground">
          Confirm what the AI did — or fix anything it got wrong.
        </span>
      </div>

      {/* Body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-4">
          <div className={SECTION_LABEL_CLASS}>
            The AI&rsquo;s plan for this email
          </div>

          <div className="mt-1">
            <DecisionRow
              num={1}
              label="What to do"
              value={actionLabel(action)}
              aiValue={actionLabel(aiValues.action)}
              status={status.action}
              isEditing={openEditor === "action"}
              onToggleEdit={() => toggleEditor("action")}
              whyOpen={whyOpen.action}
              onToggleWhy={() => toggleWhy("action")}
              why={whyText.action}
              editor={
                <OptionChips
                  options={ACTION_OPTIONS}
                  value={action}
                  onPick={(next) =>
                    pickValue("action", next, aiValues.action)
                  }
                />
              }
            />

            <DecisionRow
              num={2}
              label="Priority"
              value={priorityLabel(priority)}
              aiValue={priorityLabel(aiValues.priority)}
              status={status.priority}
              isEditing={openEditor === "priority"}
              onToggleEdit={() => toggleEditor("priority")}
              whyOpen={whyOpen.priority}
              onToggleWhy={() => toggleWhy("priority")}
              why={whyText.priority}
              editor={
                <OptionChips
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onPick={(next) =>
                    pickValue("priority", next, aiValues.priority)
                  }
                />
              }
            />

            <DecisionRow
              num={3}
              label="Project"
              value={projectDisplayLabel(projectId)}
              aiValue={projectDisplayLabel(aiValues.projectId)}
              status={status.project}
              isEditing={openEditor === "project"}
              onToggleEdit={() => toggleEditor("project")}
              whyOpen={whyOpen.project}
              onToggleWhy={() => toggleWhy("project")}
              why={whyText.project}
              editor={
                <div className="ml-8 mt-3">
                  <Popover
                    open={projectPickerOpen}
                    onOpenChange={setProjectPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto max-w-full justify-between gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-none"
                      >
                        <span className="truncate">
                          {projectDisplayLabel(projectId)}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search projects..." />
                        <CommandList>
                          <CommandEmpty>
                            {projectsLoading ? "Loading..." : "No projects found."}
                          </CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="No project assigned"
                              onSelect={() => pickProject(null)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-3.5 w-3.5",
                                  projectId === null
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              No project assigned
                            </CommandItem>
                            {projects.map((project) => (
                              <CommandItem
                                key={project.id}
                                value={`${project.project_number ?? ""} ${project.name ?? ""}`}
                                onSelect={() => pickProject(project.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-3.5 w-3.5",
                                    project.id === projectId
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                <span className="truncate">
                                  {formatProjectOption(project)}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              }
            />

            <DecisionRow
              num={4}
              label="Category"
              value={category}
              aiValue={aiValues.category}
              status={status.category}
              isEditing={openEditor === "category"}
              onToggleEdit={() => toggleEditor("category")}
              whyOpen={whyOpen.category}
              onToggleWhy={() => toggleWhy("category")}
              why={whyText.category}
              editor={
                <OptionChips
                  options={Array.from(
                    new Set<string>([aiValues.category, ...CATEGORY_OPTIONS]),
                  ).map((option) => ({ value: option, label: option }))}
                  value={category}
                  onPick={(next) =>
                    pickValue("category", next, aiValues.category)
                  }
                />
              }
            />
          </div>

          {/* Suggested reply — only when the action actually calls for a reply */}
          {needsReply ? (
          <div className="mt-4">
            <div className={SECTION_LABEL_CLASS}>Suggested reply</div>
            <div className="mt-2">
              {isEditingDraft ? (
                <Textarea
                  value={draftBody}
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder="Draft a reply..."
                  className="min-h-28 resize-y rounded-xl text-[12.5px] leading-[1.6]"
                />
              ) : draftText ? (
                <div className="whitespace-pre-line rounded-xl border border-border/70 bg-background px-3.5 py-3 text-[12.5px] leading-[1.6] text-foreground/90">
                  {draftText}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-3.5 py-3 text-[12.5px] leading-5 text-muted-foreground">
                  No draft yet. Choose{" "}
                  <span className="font-medium text-foreground">Generate</span>{" "}
                  to create one.
                </div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {replyOptions.map((option) => {
                const active = replyFeedback === option.value;
                const isRegen = option.value === "regen";
                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRegen && isGeneratingDraft}
                    onClick={() => handleReplyFeedback(option.value)}
                    className={cn(
                      "h-auto rounded-lg px-1.5 py-2 text-[11.5px] font-semibold shadow-none",
                      active
                        ? "border-foreground bg-foreground/10 text-foreground hover:bg-foreground/10 hover:text-foreground"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    {isRegen && isGeneratingDraft ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      option.label
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
          ) : null}

          {/* Submit sits directly below the last item and scrolls with the
              plan rather than pinning to a separate footer. */}
          <div className="mt-6">
            {submitted ? (
              <div className="flex items-center gap-3 rounded-xl bg-status-success/10 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-success text-primary-foreground">
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-status-success">
                    Feedback saved
                  </div>
                  <div className="text-[11.5px] text-status-success/80">
                    {counts.confirmed} confirmed · {counts.corrected} corrected
                  </div>
                </div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                  className="h-auto px-1 py-0 text-xs font-semibold text-status-success no-underline hover:underline"
                >
                  Undo
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSaveAll()}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isSaving ? "Submitting..." : "Submit feedback"}
                </Button>
                {savedAt ? (
                  <div className="mt-2 text-[11px] text-muted-foreground/70">
                    Last saved {formatFeedbackDate(savedAt)}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {/* Inbox rules — Gmail/Outlook-style filters that train the assistant
              for this mailbox (always important, never inbox, set priority). */}
          <div className="mt-8">
            <div className={SECTION_LABEL_CLASS}>Inbox rules</div>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
              Train the assistant on mail from a sender, subject, or phrase —
              always important, never inbox, or a set priority.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRuleDialogOpen(true)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Create inbox rule
              </Button>
              <a
                href={INBOX_RULES_PAGE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
              >
                <ListFilter className="h-3.5 w-3.5" />
                View rules
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </ScrollArea>

      <InboxRuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        prefill={{
          field: "sender",
          operator: "equals",
          value: selectedEmail?.from_email ?? "",
          action: "always_important",
        }}
      />
    </div>
  );
}
