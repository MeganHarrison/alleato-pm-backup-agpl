"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, ChevronDown, Download, Edit, Eye, Loader2, Mail, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  ContentSectionStack,
  DetailPanel,
  SectionRuleHeading,
} from "@/components/layout";
import { ErrorState } from "@/components/ds/error-state";
import { ConfirmDeleteDialog } from "@/components/ds/ConfirmDeleteDialog";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { StatusBadge } from "@/components/ds/status-badge";
import { DetailActions } from "@/components/ds/DetailActions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Markdown } from "@/components/misc/markdown";
import { AiFeedbackControl } from "@/components/ai/ai-feedback-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";
import { apiFetch } from "@/lib/api-client";
import { downloadPdf } from "@/hooks/use-pdf-export";
import {
  PROGRESS_REPORT_LOADING_STATES,
  PROGRESS_REPORT_LOADING_STEP_DURATION,
} from "@/lib/progress-reports/loading-states";
import {
  progressReportKeys,
  useProgressReport,
  useProgressReportHistory,
  useRefineProgressReport,
  useUpdateProgressReport,
} from "@/hooks/use-progress-reports";
import { useDeletePhoto } from "@/hooks/use-photos";
import { useProjectTitle } from "@/hooks/useProjectTitle";
import { formatProgressReportDate } from "@/lib/progress-reports/date-format";
import type {
  ProgressReportContact,
  ProgressReportPhotoRecord,
  ProgressReportStatus,
} from "@/lib/progress-reports/types";

interface EditorState {
  title: string;
  status: ProgressReportStatus;
  week_start: string;
  week_end: string;
  construction_start_date: string | null;
  scheduled_completion_date: string | null;
  past_week_highlights: string;
  upcoming_week_activities: string;
  open_items: string;
  weather_days_lost: number;
  contacts: ProgressReportContact[];
  client_recipients: string[];
  selectedPhotos: Array<{
    project_photo_id: number;
    caption: string | null;
  }>;
}

interface AiGeneratedSections {
  past_week_highlights: string;
  upcoming_week_activities: string;
  open_items: string;
}

function normalizeReportMarkdown(value: string): string {
  return value
    .split("\n")
    .map((line) =>
      line
        .trimEnd()
        .replace(/^[-*]\s+#{1,6}\s+/, "- ")
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*{1,2}([^*\n]+?)\*{1,2}/g, "**$1**"),
    )
    .join("\n");
}

function ReportMarkdownSection({
  title,
  value,
  empty,
}: {
  title: string;
  value: string;
  empty: string;
}) {
  const content = normalizeReportMarkdown(value).trim();

  return (
    <section className="space-y-3">
      <SectionRuleHeading label={title} className="mb-2" />
      {content ? (
        <Markdown
          className="text-sm leading-6 text-foreground [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:mb-3 [&_p]:leading-6 last:[&_p]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground"
        >
          {content}
        </Markdown>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

function ContactList({ contacts }: { contacts: ProgressReportContact[] }) {
  if (contacts.length === 0) {
    return <p className="text-sm text-muted-foreground">No contacts added yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {contacts.map((contact, index) => (
        <div key={`${contact.email}-${index}`} className="min-w-0 border-t border-border pt-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {contact.role || "Project Team"}
          </div>
          <div className="mt-1 text-sm font-semibold text-foreground">
            {contact.name || "Unnamed contact"}
          </div>
          {contact.email ? (
            <div className="mt-1 break-words text-sm text-muted-foreground">{contact.email}</div>
          ) : null}
          {contact.phone ? (
            <div className="text-sm text-muted-foreground">{contact.phone}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SideRailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-border/60 pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <SectionRuleHeading label={title} className="mb-0 pb-0" />
        {action}
      </div>
      {children}
    </section>
  );
}

function SideRailRow({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`min-w-0 text-sm font-medium ${valueClassName}`}>{value}</span>
    </div>
  );
}

function SideRailEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function PhotoGrid({
  photos,
  selectedPhotoIds,
  selectedPhotos,
  onToggle,
  onCaption,
  onDelete,
}: {
  photos: ProgressReportPhotoRecord[];
  selectedPhotoIds: Set<number>;
  selectedPhotos: Array<{ project_photo_id: number; caption: string | null }>;
  onToggle: (photo: ProgressReportPhotoRecord) => void;
  onCaption: (photoId: number, caption: string) => void;
  onDelete: (photo: ProgressReportPhotoRecord) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {photos.map((photo) => {
        const selected = selectedPhotoIds.has(photo.id);
        const selectedEntry = selectedPhotos.find((e) => e.project_photo_id === photo.id);
        return (
          <div
            key={photo.id}
            className={`relative rounded-xl p-3 transition-colors ${selected ? "bg-primary/5 ring-1 ring-primary/30" : "bg-muted/30"}`}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 h-7 w-7 rounded-full bg-background/80 text-muted-foreground backdrop-blur hover:bg-background hover:text-destructive"
              onClick={() => onDelete(photo)}
              aria-label={`Delete photo ${photo.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
              onClick={() => onToggle(photo)}
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <img
                  src={photo.file_url}
                  alt={photo.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{photo.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatProgressReportDate(photo.date_taken ?? photo.created_at)}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {selected ? "In report" : "Add"}
                </span>
              </div>
            </Button>
            {selected && selectedEntry !== undefined ? (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor={`photo-caption-${photo.id}`} className="text-xs">Caption</Label>
                <Input
                  id={`photo-caption-${photo.id}`}
                  value={selectedEntry.caption ?? ""}
                  onChange={(event) => onCaption(photo.id, event.target.value)}
                  placeholder="Add a caption…"
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function ProgressReportEditor({
  projectId,
  reportId,
}: {
  projectId: number;
  reportId: string;
}) {
  const queryClient = useQueryClient();
  const reportQuery = useProgressReport(projectId, reportId);
  const refineMutation = useRefineProgressReport(projectId, reportId);
  const historyQuery = useProgressReportHistory(projectId, reportId);
  const updateMutation = useUpdateProgressReport(projectId, reportId);
  const deletePhotoMutation = useDeletePhoto(projectId);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<ProgressReportPhotoRecord | null>(null);
  const [emailRecipientsInput, setEmailRecipientsInput] = useState("");
  const [emailNote, setEmailNote] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [reportAudience, setReportAudience] = useState<"client" | "internal">("client");
  const [reportLength, setReportLength] = useState<"detailed" | "brief">("detailed");

  useProjectTitle(draft?.title ?? "Progress Report");

  useEffect(() => {
    if (!reportQuery.data) return;
    const { report, selectedPhotos } = reportQuery.data;
    setDraft({
      title: report.title,
      status: report.status,
      week_start: report.week_start,
      week_end: report.week_end,
      construction_start_date: report.construction_start_date,
      scheduled_completion_date: report.scheduled_completion_date,
      past_week_highlights: report.past_week_highlights,
      upcoming_week_activities: report.upcoming_week_activities,
      open_items: report.open_items,
      weather_days_lost: report.weather_days_lost,
      contacts: report.contacts.length > 0 ? report.contacts : [],
      client_recipients: report.client_recipients,
      selectedPhotos: selectedPhotos.map((photo) => ({
        project_photo_id: photo.project_photo_id,
        caption: photo.caption,
      })),
    });
    setEmailRecipientsInput(report.client_recipients.join(", "));
  }, [reportQuery.data]);

  const selectedPhotoIds = useMemo(
    () => new Set(draft?.selectedPhotos.map((photo) => photo.project_photo_id) ?? []),
    [draft?.selectedPhotos],
  );

  const availablePhotos = reportQuery.data?.availablePhotos;

  const weekPhotos = useMemo(() => {
    if (!draft || !availablePhotos) return [];
    return availablePhotos.filter((photo) => {
      const dateStr = photo.date_taken ?? photo.created_at;
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      return d >= draft.week_start && d <= draft.week_end;
    });
  }, [availablePhotos, draft?.week_start, draft?.week_end]);

  const unselectedWeekPhotos = useMemo(
    () => weekPhotos.filter((photo) => !selectedPhotoIds.has(photo.id)),
    [weekPhotos, selectedPhotoIds],
  );

  const otherPhotos = useMemo(() => {
    if (!availablePhotos) return [];
    const weekIds = new Set(weekPhotos.map((p) => p.id));
    return availablePhotos.filter((photo) => !weekIds.has(photo.id));
  }, [availablePhotos, weekPhotos]);

  function addAllWeekPhotos() {
    setDraft((current) => {
      if (!current) return current;
      const toAdd = weekPhotos.filter(
        (photo) => !current.selectedPhotos.some((s) => s.project_photo_id === photo.id),
      );
      if (toAdd.length === 0) return current;
      return {
        ...current,
        selectedPhotos: [
          ...current.selectedPhotos,
          ...toAdd.map((photo) => ({ project_photo_id: photo.id, caption: photo.title })),
        ],
      };
    });
  }

  function updateField<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateContact(index: number, key: keyof ProgressReportContact, value: string) {
    setDraft((current) => {
      if (!current) return current;
      const contacts = current.contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, [key]: value } : contact,
      );
      return { ...current, contacts };
    });
  }

  function removeContact(index: number) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        contacts: current.contacts.filter((_, contactIndex) => contactIndex !== index),
      };
    });
  }

  function addContact() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        contacts: [
          ...current.contacts,
          { role: "", name: "", email: "", phone: "" },
        ],
      };
    });
  }

  function togglePhoto(photo: ProgressReportPhotoRecord) {
    setDraft((current) => {
      if (!current) return current;

      if (current.selectedPhotos.some((entry) => entry.project_photo_id === photo.id)) {
        return {
          ...current,
          selectedPhotos: current.selectedPhotos.filter(
            (entry) => entry.project_photo_id !== photo.id,
          ),
        };
      }

      return {
        ...current,
        selectedPhotos: [
          ...current.selectedPhotos,
          { project_photo_id: photo.id, caption: photo.title },
        ],
      };
    });
  }

  function updatePhotoCaption(projectPhotoId: number, caption: string) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        selectedPhotos: current.selectedPhotos.map((photo) =>
          photo.project_photo_id === projectPhotoId
            ? { ...photo, caption }
            : photo,
        ),
      };
    });
  }

  async function confirmDeletePhoto() {
    if (!photoToDelete) return;
    const deletedId = photoToDelete.id;
    await deletePhotoMutation.mutateAsync(deletedId);
    // Drop it from this report's selection so a saved report can't reference a deleted photo.
    setDraft((current) =>
      current
        ? {
            ...current,
            selectedPhotos: current.selectedPhotos.filter(
              (entry) => entry.project_photo_id !== deletedId,
            ),
          }
        : current,
    );
    // Refresh availablePhotos, which the report detail query owns.
    queryClient.invalidateQueries({
      queryKey: progressReportKeys.detail(projectId, reportId),
    });
    setPhotoToDelete(null);
  }

  async function handleRefreshFromDeepRead() {
    if (!draft) return;
    setIsRefreshing(true);
    try {
      const result = await apiFetch<AiGeneratedSections>(
        `/api/projects/${projectId}/progress-reports/${reportId}/refresh-from-deep-read`,
        { method: "POST" },
      );
      if (result) {
        setDraft((current) =>
          current
            ? {
                ...current,
                past_week_highlights: result.past_week_highlights,
                upcoming_week_activities: result.upcoming_week_activities,
                open_items: result.open_items,
              }
            : current,
        );
        toast.success("Pulled the latest daily deep read — review and save when ready");
      }
    } catch (error) {
      toast.error("Refresh failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleAiGenerate() {
    if (!draft) return;
    setIsGenerating(true);
    try {
      const result = await apiFetch<AiGeneratedSections>(
        `/api/projects/${projectId}/progress-reports/${reportId}/ai-generate`,
        { method: "POST" },
      );
      if (result) {
        setDraft((current) =>
          current
            ? {
                ...current,
                past_week_highlights: result.past_week_highlights,
                upcoming_week_activities: result.upcoming_week_activities,
                open_items: result.open_items,
              }
            : current,
        );
        toast.success("AI draft generated — review and save when ready");
      }
    } catch (error) {
      toast.error("AI generation failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave(nextStatus?: ProgressReportStatus) {
    if (!draft) return;

    const recipients = emailRecipientsInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    await updateMutation.mutateAsync({
      ...draft,
      status: nextStatus ?? draft.status,
      client_recipients: recipients,
      selected_photos: draft.selectedPhotos.map((photo, index) => ({
        project_photo_id: photo.project_photo_id,
        caption: photo.caption,
        sort_order: index,
      })),
    });

    if (!nextStatus) {
      toast.success("Progress report saved");
      setIsEditing(false);
    }
  }

  async function handleSendEmail() {
    if (!draft) return;
    const recipients = emailRecipientsInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      toast.error("Add at least one recipient before sending");
      return;
    }

    setIsSending(true);
    try {
      await handleSave("sent");

      await apiFetch(`/api/projects/${projectId}/progress-reports/${reportId}/email`, {
        method: "POST",
        body: JSON.stringify({
          recipients,
          note: emailNote.trim() || null,
        }),
      });

      toast.success("Progress report emailed");
      reportQuery.refetch();
    } catch (error) {
      toast.error(
        "Could not email progress report",
        { description: error instanceof Error ? error.message : String(error) },
      );
    } finally {
      setIsSending(false);
    }
  }

  if (reportQuery.isError) {
    return (
      <ErrorState
        title="Could not load progress report"
        error={reportQuery.error}
        onRetry={() => void reportQuery.refetch()}
      />
    );
  }

  // ── Loading ──
  if (reportQuery.isLoading || !draft || !reportQuery.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const report = reportQuery.data.report;
  const detail = reportQuery.data;
  const selectedPhotos = detail.selectedPhotos.filter((photo) =>
    selectedPhotoIds.has(photo.project_photo_id),
  );

  const weekRange = `${formatProgressReportDate(draft.week_start)} – ${formatProgressReportDate(draft.week_end)}`;
  // Either AI action is running — used to disable the whole "Draft with AI" menu.
  const aiBusy = isGenerating || isRefreshing;

  const handleCancelEdit = () => {
    const { report: currentReport, selectedPhotos: currentSelectedPhotos } = detail;
    setDraft({
      title: currentReport.title,
      status: currentReport.status,
      week_start: currentReport.week_start,
      week_end: currentReport.week_end,
      construction_start_date: currentReport.construction_start_date,
      scheduled_completion_date: currentReport.scheduled_completion_date,
      past_week_highlights: currentReport.past_week_highlights,
      upcoming_week_activities: currentReport.upcoming_week_activities,
      open_items: currentReport.open_items,
      weather_days_lost: currentReport.weather_days_lost,
      contacts: currentReport.contacts.length > 0 ? currentReport.contacts : [],
      client_recipients: currentReport.client_recipients,
      selectedPhotos: currentSelectedPhotos.map((photo) => ({
        project_photo_id: photo.project_photo_id,
        caption: photo.caption,
      })),
    });
    setEmailRecipientsInput(currentReport.client_recipients.join(", "));
    setIsEditing(false);
  };

  const viewQuery = `audience=${reportAudience}&length=${reportLength}`;
  const previewSrc = `/api/projects/${projectId}/progress-reports/${reportId}/pdf?format=html&${viewQuery}`;
  const handleDownloadPdf = () => {
    void downloadPdf({
      endpoint: `/api/projects/${projectId}/progress-reports/${reportId}/pdf?${viewQuery}`,
      filename: `${draft.title || "progress-report"} (${reportAudience}, ${reportLength})`,
      errorMessage: "Progress report PDF download failed. Try again.",
    });
  };

  // ── Edit mode ──
  if (isEditing) {
    return (
      <div className="space-y-8">
        <MultiStepLoader
          loadingStates={PROGRESS_REPORT_LOADING_STATES}
          loading={isGenerating}
          duration={PROGRESS_REPORT_LOADING_STEP_DURATION}
          loop={false}
          holdNote="This usually takes a minute or two. We're reading through recent meetings, emails, and site updates to write the draft. You can keep this tab open."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{draft.title}</p>
            <p className="text-xs text-muted-foreground">{weekRange}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* One AI entry point. Each option says, in plain terms, what it does and how long it takes. */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={aiBusy || updateMutation.isPending}
                    >
                      {aiBusy ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-4 w-4" />
                      )}
                      {aiBusy ? "Writing…" : "Draft with AI"}
                      <ChevronDown className="ml-1.5 h-4 w-4 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Let AI write the summary sections for you</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuItem
                  className="flex-col items-start gap-0.5 py-2.5"
                  onSelect={() => void handleRefreshFromDeepRead()}
                  disabled={aiBusy || updateMutation.isPending}
                >
                  <span className="text-sm font-medium text-foreground">
                    Update with the latest activity
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Pulls in this week&apos;s meetings, emails, and site updates, then rewrites the summary. Takes a few seconds.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex-col items-start gap-0.5 py-2.5"
                  onSelect={() => void handleAiGenerate()}
                  disabled={aiBusy || updateMutation.isPending}
                >
                  <span className="text-sm font-medium text-foreground">
                    Rewrite the whole summary from scratch
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Re-reads all recent project activity for a fresh draft. More thorough, can take a minute or two.
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-1 h-5 w-px bg-border" aria-hidden />

            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSave()}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-10">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-title">Report title</Label>
              <Input
                id="report-title"
                value={draft.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-start">Week start</Label>
              <Input
                id="week-start"
                type="date"
                value={draft.week_start}
                onChange={(event) => updateField("week_start", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="week-end">Week end</Label>
              <Input
                id="week-end"
                type="date"
                value={draft.week_end}
                onChange={(event) => updateField("week_end", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => updateField("status", value as ProgressReportStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="construction-start">Construction start</Label>
              <Input
                id="construction-start"
                type="date"
                value={draft.construction_start_date ?? ""}
                onChange={(event) =>
                  updateField("construction_start_date", event.target.value || null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled-completion">Scheduled completion</Label>
              <Input
                id="scheduled-completion"
                type="date"
                value={draft.scheduled_completion_date ?? ""}
                onChange={(event) =>
                  updateField("scheduled_completion_date", event.target.value || null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weather-days">Weather days lost</Label>
              <Input
                id="weather-days"
                type="number"
                min={0}
                value={draft.weather_days_lost}
                onChange={(event) =>
                  updateField("weather_days_lost", Number.parseInt(event.target.value || "0", 10))
                }
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <div className="space-y-8">
              <div className="space-y-2">
                <Label htmlFor="highlights">Past week&apos;s highlights</Label>
                <Textarea
                  id="highlights"
                  rows={8}
                  value={draft.past_week_highlights}
                  onChange={(event) => updateField("past_week_highlights", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upcoming">Upcoming week&apos;s activities</Label>
                <Textarea
                  id="upcoming"
                  rows={8}
                  value={draft.upcoming_week_activities}
                  onChange={(event) => updateField("upcoming_week_activities", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open-items">Open items</Label>
                <Textarea
                  id="open-items"
                  rows={7}
                  value={draft.open_items}
                  onChange={(event) => updateField("open_items", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4 rounded-xl bg-muted/40 px-5 py-4">
                <div>
                  <SectionRuleHeading label="Client delivery" className="mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Save recipient defaults here, then email the generated PDF directly from the report.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-recipients">Recipients</Label>
                  <Input
                    id="client-recipients"
                    placeholder="client@example.com, pm@example.com"
                    value={emailRecipientsInput}
                    onChange={(event) => setEmailRecipientsInput(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-note">Optional note</Label>
                  <Textarea
                    id="email-note"
                    rows={4}
                    value={emailNote}
                    onChange={(event) => setEmailNote(event.target.value)}
                  />
                </div>
                {draft.status === "draft" && (
                  <InfoAlert variant="warning">
                    Set the report status to <strong>Ready</strong> before emailing. Draft reports cannot be sent to clients.
                  </InfoAlert>
                )}
                <Button
                  className="w-full gap-2"
                  onClick={() => void handleSendEmail()}
                  disabled={isSending || draft.status === "draft"}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Email PDF
                </Button>
              </div>

              <div className="space-y-4 rounded-xl bg-muted/40 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <SectionRuleHeading label="Project Team" className="mb-2" />
                    <p className="text-sm text-muted-foreground">
                      These show in the report footer.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-2" onClick={addContact}>
                    <Plus className="h-4 w-4" />
                    Add contact
                  </Button>
                </div>

                {draft.contacts.length > 0 ? (
                  <div className="space-y-3">
                    {draft.contacts.map((contact, index) => (
                      <div key={`${contact.email}-${index}`} className="grid gap-3 rounded-lg bg-background px-3 py-3">
                        <div className="flex justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => removeContact(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Role"
                          value={contact.role}
                          onChange={(event) => updateContact(index, "role", event.target.value)}
                        />
                        <Input
                          placeholder="Name"
                          value={contact.name}
                          onChange={(event) => updateContact(index, "name", event.target.value)}
                        />
                        <Input
                          placeholder="Email"
                          value={contact.email}
                          onChange={(event) => updateContact(index, "email", event.target.value)}
                        />
                        <Input
                          placeholder="Phone"
                          value={contact.phone}
                          onChange={(event) => updateContact(index, "phone", event.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No contacts added yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionRuleHeading label="Photos" className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  Choose which project photos appear in the PDF. Click to add or remove; edit captions on selected photos. Use the trash icon to permanently remove a photo from the project.
                </p>
              </div>
              {unselectedWeekPhotos.length > 0 && (
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={addAllWeekPhotos}>
                  <Plus className="h-4 w-4" />
                  Add all from this week ({unselectedWeekPhotos.length})
                </Button>
              )}
            </div>

            {(availablePhotos ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos uploaded for this project yet.</p>
            ) : (
              <div className="space-y-6">
                {weekPhotos.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      This week — {formatProgressReportDate(draft.week_start)} to {formatProgressReportDate(draft.week_end)} ({weekPhotos.length})
                    </div>
                    <PhotoGrid
                      photos={weekPhotos}
                      selectedPhotoIds={selectedPhotoIds}
                      selectedPhotos={draft.selectedPhotos}
                      onToggle={togglePhoto}
                      onCaption={updatePhotoCaption}
                      onDelete={setPhotoToDelete}
                    />
                  </div>
                )}
                {otherPhotos.length > 0 && (
                  <div className="space-y-3">
                    {weekPhotos.length > 0 && (
                      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Other recent photos ({otherPhotos.length})
                      </div>
                    )}
                    <PhotoGrid
                      photos={otherPhotos}
                      selectedPhotoIds={selectedPhotoIds}
                      selectedPhotos={draft.selectedPhotos}
                      onToggle={togglePhoto}
                      onCaption={updatePhotoCaption}
                      onDelete={setPhotoToDelete}
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <SectionRuleHeading label="Sources used to generate this draft" className="mb-3" />
            <p className="text-sm text-muted-foreground">
              These records were used to populate the report. Click any link to verify the source.
            </p>
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="rounded-xl bg-muted/30 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meetings</span>
                  <Link
                    href={`/${projectId}/meetings`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    target="_blank"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {report?.source_snapshot.meetings.length ? (
                  <ul className="space-y-3 text-sm">
                    {report.source_snapshot.meetings.map((meeting) => (
                      <li key={meeting.id}>
                        <Link
                          href={`/${projectId}/meetings/${meeting.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                          target="_blank"
                        >
                          {meeting.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {formatProgressReportDate(meeting.date, "MMM d, yyyy", "No date")}
                        </div>
                        {meeting.summary ? (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{meeting.summary}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No meeting sources were captured for this draft.</p>
                )}
              </div>

              <div className="rounded-xl bg-muted/30 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emails</span>
                  <Link
                    href={`/${projectId}/emails`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    target="_blank"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                {report?.source_snapshot.emails.length ? (
                  <ul className="space-y-3 text-sm">
                    {report.source_snapshot.emails.map((email) => (
                      <li key={email.id}>
                        <div className="font-medium text-foreground">{email.subject}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatProgressReportDate(email.date, "MMM d, yyyy", "No date")}
                        </div>
                        {email.preview ? (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{email.preview}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No email sources were captured for this draft.</p>
                )}
              </div>

              <div className="rounded-xl bg-muted/30 px-4 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos</span>
                  <span className="text-xs text-muted-foreground">
                    {report?.source_snapshot.photos.length ?? 0} in snapshot
                  </span>
                </div>
                {report?.source_snapshot.photos.length ? (
                  <div className="grid grid-cols-3 gap-2">
                    {report.source_snapshot.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={photo.title}
                        className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
                      >
                        { }
                        <img
                          src={photo.file_url}
                          alt={photo.title}
                          className="h-full w-full object-cover transition-opacity group-hover:opacity-75"
                        />
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                          <p className="truncate px-1.5 pb-1 text-[10px] text-primary-foreground">{photo.title}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos were captured for this draft.</p>
                )}
                {report?.source_snapshot.generatedAt && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Draft generated {formatProgressReportDate(report.source_snapshot.generatedAt, "MMM d, yyyy h:mm a")}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        <ConfirmDeleteDialog
          open={photoToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPhotoToDelete(null);
          }}
          itemName={photoToDelete?.title ?? "photo"}
          title="Delete this photo?"
          description="This removes the photo from the project and from any progress report that uses it. This action cannot be undone."
          confirmLabel="Delete photo"
          isDeleting={deletePhotoMutation.isPending}
          onConfirm={confirmDeletePhoto}
        />
      </div>
    );
  }

  // ── View mode ──
  return (
    <ContentSectionStack>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-foreground">{draft.title}</p>
          <p className="text-xs text-muted-foreground">{weekRange}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refineMutation.mutate()}
            disabled={refineMutation.isPending}
          >
            {refineMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {refineMutation.isPending ? "Refining…" : "Refine from intelligence"}
          </Button>
          <Button size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="mr-1.5 h-4 w-4" />
            Edit Progress Report
          </Button>
          <DetailActions
            extraActions={[
              {
                label: "Preview Report",
                icon: <Eye className="h-4 w-4" />,
                onClick: () => setIsPreviewOpen(true),
              },
              {
                label: "Download PDF",
                icon: <Download className="h-4 w-4" />,
                onClick: handleDownloadPdf,
              },
            ]}
          />
        </div>
      </div>

      {historyQuery.data?.versions?.length ? (
        <p className="text-xs text-muted-foreground">
          Version {report.version} · {historyQuery.data.versions.length} saved report versions
        </p>
      ) : null}

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent size="fullscreen" className="flex flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <DialogTitle className="text-sm font-medium">Report preview</DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                size="sm"
                value={reportAudience}
                onValueChange={(v) => v && setReportAudience(v as "client" | "internal")}
              >
                <ToggleGroupItem value="client">Client</ToggleGroupItem>
                <ToggleGroupItem value="internal">Internal</ToggleGroupItem>
              </ToggleGroup>
              <ToggleGroup
                type="single"
                size="sm"
                value={reportLength}
                onValueChange={(v) => v && setReportLength(v as "detailed" | "brief")}
              >
                <ToggleGroupItem value="detailed">Detailed</ToggleGroupItem>
                <ToggleGroupItem value="brief">Brief</ToggleGroupItem>
              </ToggleGroup>
              <Button size="sm" variant="outline" onClick={handleDownloadPdf}>
                <Download className="mr-1.5 h-4 w-4" />
                Download this version
              </Button>
            </div>
          </DialogHeader>
          {isPreviewOpen && (
            <iframe
              key={viewQuery}
              title="Progress report preview"
              src={previewSrc}
              className="min-h-0 flex-1 bg-background"
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <div className="space-y-0">
          <DetailPanel className="space-y-8">
            <ReportMarkdownSection
              title="Past Week's Highlights"
              value={draft.past_week_highlights}
              empty="No past week highlights added yet."
            />
            <ReportMarkdownSection
              title="Upcoming Week's Activities"
              value={draft.upcoming_week_activities}
              empty="No upcoming activities added yet."
            />
            <ReportMarkdownSection
              title="Open Items"
              value={draft.open_items}
              empty="No open items added yet."
            />
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>Rate this AI draft</span>
              <AiFeedbackControl
                surface="progress_report"
                subjectType="progress_report"
                subjectId={reportId}
                projectId={projectId}
                contentText={[
                  draft.past_week_highlights,
                  draft.upcoming_week_activities,
                  draft.open_items,
                ].join("\n\n")}
              />
            </div>
            <section className="space-y-3">
              <SectionRuleHeading label="Days Lost Due to Weather" className="mb-2" />
              <p className="text-sm font-medium text-foreground">
                {draft.weather_days_lost} day{draft.weather_days_lost === 1 ? "" : "s"}
              </p>
            </section>

            {(selectedPhotos.length > 0 || unselectedWeekPhotos.length > 0) && (
              <section className="space-y-3">
                <SectionRuleHeading label="Progress Photos" className="mb-2" />
                {selectedPhotos.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {selectedPhotos.map((selection) => (
                      <figure key={selection.id} className="space-y-2">
                        <div className="aspect-[4/3] overflow-hidden rounded-md bg-muted">
                          <img
                            src={selection.photo.file_url}
                            alt={selection.photo.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <figcaption className="text-sm">
                          <div className="font-medium text-foreground">
                            {selection.caption || selection.photo.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatProgressReportDate(selection.photo.date_taken ?? selection.photo.created_at)}
                          </div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
                {unselectedWeekPhotos.length > 0 && (
                  <InfoAlert variant="info">
                    <span className="flex items-center justify-between gap-3">
                      <span>{unselectedWeekPhotos.length} photo{unselectedWeekPhotos.length === 1 ? "" : "s"} from this week not yet included in the report.</span>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Add Photos</Button>
                    </span>
                  </InfoAlert>
                )}
              </section>
            )}

          </DetailPanel>
        </div>

        <aside className="space-y-6 xl:border-l xl:border-border/60 xl:pl-6">
          <SideRailSection title="Report">
            <div className="space-y-3">
              <SideRailRow label="Status" value={<StatusBadge status={draft.status} />} />
              <SideRailRow label="Week start" value={formatProgressReportDate(draft.week_start)} />
              <SideRailRow label="Week end" value={formatProgressReportDate(draft.week_end)} />
              <SideRailRow
                label="Construction start"
                value={formatProgressReportDate(draft.construction_start_date) || "—"}
                valueClassName={draft.construction_start_date ? "text-foreground" : "text-muted-foreground"}
              />
              <SideRailRow
                label="Substantial completion"
                value={formatProgressReportDate(draft.scheduled_completion_date) || "—"}
                valueClassName={draft.scheduled_completion_date ? "text-foreground" : "text-muted-foreground"}
              />
              <SideRailRow
                label="Weather lost"
                value={`${draft.weather_days_lost} day${draft.weather_days_lost === 1 ? "" : "s"}`}
              />
            </div>
          </SideRailSection>

          <SideRailSection
            title="Delivery"
            action={
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setIsEditing(true)}
                aria-label="Edit delivery details"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Client recipients</p>
                {draft.client_recipients.length > 0 ? (
                  <div className="space-y-1">
                    {draft.client_recipients.map((recipient) => (
                      <p key={recipient} className="break-words text-sm font-medium text-foreground">
                        {recipient}
                      </p>
                    ))}
                  </div>
                ) : (
                  <SideRailEmpty>No recipients saved.</SideRailEmpty>
                )}
              </div>
            </div>
          </SideRailSection>

          <SideRailSection title="Project Team">
            {draft.contacts.length > 0 ? (
              <div className="space-y-3">
                {draft.contacts.map((contact, index) => (
                  <SideRailRow
                    key={`${contact.email}-${index}`}
                    label={contact.role || "Project team"}
                    value={
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-foreground">
                          {contact.name || "Unnamed contact"}
                        </div>
                        {contact.email ? (
                          <div className="break-words text-xs text-muted-foreground">
                            {contact.email}
                          </div>
                        ) : null}
                        {contact.phone ? (
                          <div className="text-xs text-muted-foreground">{contact.phone}</div>
                        ) : null}
                      </div>
                    }
                  />
                ))}
              </div>
            ) : (
              <SideRailEmpty>No project team contacts added.</SideRailEmpty>
            )}
          </SideRailSection>

          <SideRailSection title="Source Context">
            {(() => {
              const snap = reportQuery.data.report.source_snapshot;
              const hasSources =
                snap.meetings.length > 0 ||
                snap.emails.length > 0 ||
                snap.photos.length > 0;

              if (!hasSources) {
                return <SideRailEmpty>No source records were captured for this draft.</SideRailEmpty>;
              }

              return (
                <div className="space-y-5">
                  {snap.generatedAt ? (
                    <p className="text-xs text-muted-foreground">
                      Generated {formatProgressReportDate(snap.generatedAt, "MMM d, yyyy")}
                    </p>
                  ) : null}

                  {snap.meetings.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Meetings
                        </p>
                        <span className="text-xs text-muted-foreground">{snap.meetings.length}</span>
                      </div>
                      <ul className="space-y-2">
                        {snap.meetings.slice(0, 3).map((meeting) => (
                          <li key={meeting.id}>
                            <Link
                              href={`/${projectId}/meetings/${meeting.id}`}
                              className="group block text-sm text-foreground hover:text-primary"
                              target="_blank"
                            >
                              <span className="line-clamp-2 font-medium">{meeting.title}</span>
                              {meeting.date ? (
                                <span className="block text-xs text-muted-foreground">
                                  {formatProgressReportDate(meeting.date)}
                                </span>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {snap.emails.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Emails
                        </p>
                        <span className="text-xs text-muted-foreground">{snap.emails.length}</span>
                      </div>
                      <ul className="space-y-2">
                        {snap.emails.slice(0, 3).map((email) => (
                          <li key={email.id} className="text-sm">
                            <p className="line-clamp-2 font-medium text-foreground">{email.subject}</p>
                            {email.date ? (
                              <p className="text-xs text-muted-foreground">
                                {formatProgressReportDate(email.date)}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {snap.photos.length > 0 ? (
                    <div className="space-y-3">
                      <SideRailRow label="Photos in snapshot" value={String(snap.photos.length)} />
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </SideRailSection>
        </aside>
      </div>
    </ContentSectionStack>
  );
}
