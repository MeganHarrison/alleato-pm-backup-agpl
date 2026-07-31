"use client";

import {
  Calendar,
  ChevronDown,
  Clock,
  ArrowRight,
  FileText,
  FolderOpen,
  Plus,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  AiFeedbackControl,
  type AiFeedbackReason,
} from "@/components/ai/ai-feedback-control";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateAvatar, EmptyState } from "@/components/ds";
import {
  DetailPropertyBar,
  DetailPropertyItem,
} from "@/components/ui/detail-property-bar";
import { PageShell } from "@/components/layout";
import type { CuratedMeetingRisk } from "@/lib/meetings/server";
import { areSemanticallySimilar } from "@/lib/meetings/text-dedupe";
import { AttendeeAvatarStack } from "@/components/meetings/attendee-avatar-stack";
import { MeetingCategoryControl } from "@/components/meetings/meeting-category-control";
import { MeetingTasksManager } from "@/components/meetings/meeting-tasks-manager";
import { useProjects } from "@/hooks/use-projects";
import { apiFetch } from "@/lib/api-client";
import type { Database } from "@/types/database.types";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

type MeetingSegment =
  Database["public"]["Tables"]["meeting_segments"]["Row"] & {
    opportunities?: unknown[];
  };

type DocumentMetadata =
  Database["public"]["Tables"]["document_metadata"]["Row"] & {
    duration?: number;
  };

interface ParsedSections {
  firefliesId: string | null;
  firefliesLink: string | null;
  organizerEmail: string | null;
  hostEmail: string | null;
  summary: string | null;
  gist: string | null;
  keywords: string | null;
  shortSummary: string | null;
  shortOverview: string | null;
  bulletGist: string | null;
  shorthandBullet: string | null;
  outline: string | null;
  notes: string | null;
  meetingType: string | null;
  topicsDiscussed: string | null;
  transcriptChapters: string | null;
  actionItems: string | null;
  meetingAttendees: string | null;
  meetingAttendance: string | null;
  analytics: string | null;
  meetingInfo: string | null;
  channels: string | null;
  appsPreview: string | null;
  sharedWith: string | null;
  extendedSections: string | null;
  user: string | null;
  speakers: string | null;
  transcript: string | null;
}

interface RelatedMeeting {
  id: string;
  title: string | null;
  date: string | null;
  created_at: string | null;
  duration_minutes: number | null;
}

function meetingSegmentAnchorId(segmentId: string) {
  return `meeting-segment-${segmentId}`;
}

export interface MeetingTask {
  id: string;
  title: string | null;
  description: string;
  assignee_person_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
  segment_id: string | null;
}

export interface MeetingDetailContentProps {
  meeting: DocumentMetadata;
  segments: MeetingSegment[];
  parsedSections: ParsedSections | null;
  participantsList: string[];
  allTasks: string[];
  riskItems: Array<
    | CuratedMeetingRisk
    | {
        id: string;
        text: string;
        whyItMatters: string | null;
        confidence: string | null;
        source: "segment_fallback";
      }
  >;
  allDecisions: string[];
  allOpportunities: string[];
  meetingTasks?: MeetingTask[];
  transcriptContent: string | null;
  /** True when a stored transcript existed but the fetch failed (vs. never processed) */
  transcriptLoadFailed?: boolean;
  relatedMeetings?: RelatedMeeting[];
  relatedMeetingsBaseHref?: string;
  /** Render slot for the FormattedTranscript */
  transcriptSlot?: React.ReactNode;
}

// ─── Collapsible Section ────────────────────────────────────────────────────

function AccordionSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between group">
        {/* eslint-disable-next-line design-system/no-raw-heading */}
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </h2>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function SummarySubsection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line design-system/no-raw-heading */}
      <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </h3>
      {children}
    </div>
  );
}

// ─── Sidebar List ───────────────────────────────────────────────────────────

const MEETING_RISK_POSITIVE_REASONS: AiFeedbackReason[] = [
  { id: "real_risk", label: "This is a real risk" },
  { id: "well_scoped", label: "Well scoped" },
  { id: "actionable", label: "Actionable wording" },
  { id: "right_priority", label: "Right priority" },
];

const MEETING_RISK_NEGATIVE_REASONS: AiFeedbackReason[] = [
  { id: "duplicate_risk", label: "Duplicate of another risk" },
  { id: "not_a_risk", label: "Not actually a risk" },
  { id: "too_vague", label: "Too vague" },
  { id: "wrong_priority", label: "Wrong priority" },
  { id: "missing_context", label: "Missing context" },
];

function SidebarList<T>({
  label,
  items,
  getItemKey,
  renderItem,
  renderItemActions,
}: {
  label: string;
  items: T[];
  getItemKey?: (item: T, index: number) => React.Key;
  renderItem?: (item: T, index: number) => React.ReactNode;
  renderItemActions?: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li
            key={getItemKey ? getItemKey(item, idx) : idx}
            className="group flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
          >
            <span aria-hidden className="mt-0.5 text-muted-foreground">
              -
            </span>
            <div className="min-w-0 flex-1">
              {renderItem ? renderItem(item, idx) : String(item)}
            </div>
            {renderItemActions ? (
              <div className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {renderItemActions(item, idx)}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Action items (grouped by assignee) ──────────────────────────────────────

interface ActionItemGroup {
  assignee: string | null;
  items: string[];
}

/**
 * Parse Fireflies action-item text into groups keyed by assignee.
 *
 * Fireflies groups every action item under a bold `**Owner Name**` header.
 * Ingestion preserves that grouping in `action_items`, so each `**Name**` line
 * starts a new owner group and the bullet lines beneath belong to that owner.
 * Items that appear before any header (older transcripts) are "Unassigned".
 */
function parseActionItemsByAssignee(text: string): ActionItemGroup[] {
  const groups: ActionItemGroup[] = [];
  let current: ActionItemGroup | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (headerMatch) {
      current = { assignee: headerMatch[1].trim(), items: [] };
      groups.push(current);
      continue;
    }

    const itemText = line.replace(/^[-*]\s*/, "").trim();
    if (!itemText) continue;
    if (!current) {
      current = { assignee: null, items: [] };
      groups.push(current);
    }
    current.items.push(itemText);
  }

  return groups.filter((group) => group.items.length > 0);
}

function ActionItemsByAssignee({ content }: { content: string }) {
  const groups = parseActionItemsByAssignee(content);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-5">
      {groups.map((group, groupIdx) => (
        <div key={groupIdx} className="space-y-2">
          <div className="text-sm font-semibold text-foreground">
            {group.assignee ?? "Unassigned"}
          </div>
          <ul className="space-y-2">
            {group.items.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Markdown preprocessing ─────────────────────────────────────────────────

/**
 * Pre-process Fireflies content so ReactMarkdown can parse it properly.
 * Adds blank lines before emoji-prefixed sections (🏭 **Title** ...).
 */
function preprocessMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detect lines starting with emoji (Unicode emoji ranges)
    const cp = line.codePointAt(0) ?? 0;
    const startsWithEmoji =
      (cp >= 0x1f300 && cp <= 0x1fad6) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0x2700 && cp <= 0x27bf);

    if (startsWithEmoji && i > 0) {
      result.push("");
      result.push(line);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function FirefliesSectionContent({ value }: { value: string }) {
  const trimmed = value.trim();
  const looksJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"));

  if (looksJson) {
    try {
      const parsed = JSON.parse(trimmed);
      return (
        <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono rounded-md bg-muted/40 p-3">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch (error) {
      reportNonCriticalFailure({
        area: "meeting-detail",
        operation: "parse-json-content",
        error,
        userVisibleFallback:
          "Meeting content was rendered as markdown instead of JSON.",
      });
    }
  }

  const processed = preprocessMarkdown(trimmed);

  return (
    <div className="space-y-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            // eslint-disable-next-line design-system/no-raw-heading
            <h3 className="text-sm font-semibold text-foreground pt-4 first:pt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            // eslint-disable-next-line design-system/no-raw-heading
            <h3 className="text-sm font-semibold text-foreground pt-4 first:pt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            // eslint-disable-next-line design-system/no-raw-heading
            <h4 className="text-xs font-semibold text-foreground pt-3 first:pt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-muted-foreground leading-relaxed pb-1">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1 pl-4 list-disc">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-4 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-muted-foreground leading-relaxed">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

function meaningfulText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === "{}" || trimmed === "[]") {
    return null;
  }

  return trimmed;
}

function shouldShowRiskDetail(
  title: string,
  whyItMatters: string | null | undefined,
): whyItMatters is string {
  const detail = meaningfulText(whyItMatters);
  if (!detail) return false;

  return !areSemanticallySimilar(title, detail, 0.5);
}

// ─── Project Assignment Dialog ───────────────────────────────────────────────

function ProjectAssignmentDialog({
  open,
  onOpenChange,
  meetingTitle,
  selectedProjectId,
  onSelectedProjectIdChange,
  onSave,
  projects,
  isLoadingProjects,
  projectLoadError,
  isSaving,
  hasProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingTitle: string;
  selectedProjectId: string;
  onSelectedProjectIdChange: (value: string) => void;
  onSave: () => void;
  projects: ReturnType<typeof useProjects>["projects"];
  isLoadingProjects: boolean;
  projectLoadError: Error | null;
  isSaving: boolean;
  hasProject: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {hasProject ? "Change project" : "Assign to project"}
          </DialogTitle>
          <DialogDescription>{meetingTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Select
            value={selectedProjectId || "__none__"}
            onValueChange={(value) => {
              onSelectedProjectIdChange(value === "__none__" ? "" : value);
            }}
            disabled={isLoadingProjects || isSaving}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingProjects ? "Loading projects..." : "Select a project"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={String(project.id)}>
                  {project.project_number
                    ? `${project.project_number} - ${project.name || "Unnamed Project"}`
                    : project.name || `Project #${project.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {projectLoadError ? (
            <p className="text-xs text-destructive">
              Failed to load projects: {projectLoadError.message}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isLoadingProjects || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MeetingDetailContent({
  meeting,
  segments,
  parsedSections,
  participantsList,
  allTasks: _allTasks,
  riskItems,
  allDecisions: _allDecisions,
  allOpportunities,
  meetingTasks = [],
  transcriptContent,
  transcriptLoadFailed = false,
  relatedMeetings = [],
  relatedMeetingsBaseHref,
  transcriptSlot,
}: MeetingDetailContentProps) {
  const {
    projects,
    isLoading: isLoadingProjects,
    error: projectLoadError,
  } = useProjects({
    limit: 500,
  });
  const [assignmentDialogOpen, setAssignmentDialogOpen] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState(
    meeting.project_id ? String(meeting.project_id) : "",
  );
  const [assignedProjectId, setAssignedProjectId] = React.useState<
    number | null
  >(meeting.project_id);
  const [assignedProjectName, setAssignedProjectName] = React.useState<
    string | null
  >(meeting.project);
  const [isSavingProject, setIsSavingProject] = React.useState(false);

  React.useEffect(() => {
    setSelectedProjectId(meeting.project_id ? String(meeting.project_id) : "");
    setAssignedProjectId(meeting.project_id);
    setAssignedProjectName(meeting.project);
  }, [meeting.id, meeting.project, meeting.project_id]);

  const selectedProject = React.useMemo(
    () =>
      projects.find((project) => String(project.id) === selectedProjectId) ??
      null,
    [projects, selectedProjectId],
  );

  const assignedProject = React.useMemo(
    () => projects.find((project) => project.id === assignedProjectId) ?? null,
    [assignedProjectId, projects],
  );

  const projectLabel =
    assignedProject?.name ||
    assignedProjectName ||
    (assignedProjectId ? `Project #${assignedProjectId}` : null);
  const createMeetingHref = assignedProjectId
    ? `/${assignedProjectId}/meetings/new`
    : null;

  const handleSaveProjectAssignment = async () => {
    const nextProjectId = selectedProjectId ? Number(selectedProjectId) : null;
    if (selectedProjectId && !Number.isFinite(nextProjectId)) {
      toast.error("Select a valid project before saving");
      return;
    }

    setIsSavingProject(true);
    try {
      await apiFetch(`/api/documents/${meeting.id}/assign-project`, {
        method: "PATCH",
        body: JSON.stringify({ project_id: nextProjectId }),
      });
      setAssignedProjectId(nextProjectId);
      setAssignedProjectName(
        nextProjectId ? (selectedProject?.name ?? null) : null,
      );
      setAssignmentDialogOpen(false);
      toast.success(
        nextProjectId
          ? "Meeting assigned to project"
          : "Project assignment removed",
      );
    } catch (error) {
      toast.error("Failed to assign meeting to project");
    } finally {
      setIsSavingProject(false);
    }
  };

  const overviewContent =
    meaningfulText(parsedSections?.shortSummary) ||
    meaningfulText(parsedSections?.shortOverview) ||
    meaningfulText(parsedSections?.gist) ||
    meaningfulText(parsedSections?.bulletGist) ||
    meaningfulText(meeting.overview) ||
    meaningfulText(meeting.summary) ||
    undefined;
  const notesContent =
    meaningfulText(parsedSections?.notes) || meaningfulText(meeting.notes);
  const actionItemsContent =
    meaningfulText(parsedSections?.actionItems) ||
    meaningfulText(meeting.action_items);
  const summaryOverviewContent =
    meaningfulText(parsedSections?.shortOverview) ||
    meaningfulText(parsedSections?.shortSummary) ||
    meaningfulText(parsedSections?.gist) ||
    meaningfulText(parsedSections?.summary) ||
    meaningfulText(meeting.overview) ||
    meaningfulText(meeting.summary);
  // The top "Meeting Overview" already leads with the prose read; only surface
  // the Summary → Overview subsection when it says something different, so the
  // same paragraph isn't printed twice on the page.
  const summaryOverviewDistinct =
    summaryOverviewContent &&
    !(
      overviewContent &&
      areSemanticallySimilar(summaryOverviewContent, overviewContent)
    )
      ? summaryOverviewContent
      : undefined;
  const shorthandBullet =
    meaningfulText(parsedSections?.shorthandBullet) ||
    meaningfulText(meeting.bullet_points);
  const hasActionSnapshot =
    riskItems.length > 0 || allOpportunities.length > 0;
  const hasSummarySection =
    Boolean(summaryOverviewDistinct) ||
    Boolean(notesContent) ||
    Boolean(actionItemsContent);

  const keywordList = React.useMemo(
    () =>
      (parsedSections?.keywords ?? "")
        .split(/[,\n]/)
        .map((k) => k.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean),
    [parsedSections?.keywords],
  );
  const KEYWORD_LIMIT = 8;
  const [showAllKeywords, setShowAllKeywords] = React.useState(false);
  const visibleKeywords = showAllKeywords
    ? keywordList
    : keywordList.slice(0, KEYWORD_LIMIT);
  const hiddenKeywordCount = keywordList.length - visibleKeywords.length;

  return (
    <PageShell
      variant="detailWide"
      title={meeting.title || "Untitled Meeting"}
      actions={
        createMeetingHref ? (
          <Button asChild size="sm">
            <Link
              href={createMeetingHref}
              aria-label={
                projectLabel
                  ? `Create meeting for ${projectLabel}`
                  : "Create meeting"
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Create meeting
            </Link>
          </Button>
        ) : undefined
      }
      contentClassName="pb-12"
    >
      <DetailPropertyBar>
        {meeting.date ? (
          <DetailPropertyItem icon={Calendar}>
            {format(new Date(meeting.date), "EEEE, MMMM d, yyyy · h:mm a")}
          </DetailPropertyItem>
        ) : null}
        {meeting.duration_minutes ? (
          <DetailPropertyItem icon={Clock}>
            {meeting.duration_minutes} min
          </DetailPropertyItem>
        ) : null}
        <DetailPropertyItem
          icon={FolderOpen}
          onClick={() => setAssignmentDialogOpen(true)}
          muted={!projectLabel}
        >
          {projectLabel ?? "Assign to project"}
        </DetailPropertyItem>
        <MeetingCategoryControl
          meetingId={meeting.id}
          meetingTitle={meeting.title || "Untitled Meeting"}
          initialCategory={meeting.category}
        />
        {meeting.fireflies_link ? (
          <DetailPropertyItem
            icon={ArrowRight}
            href={meeting.fireflies_link}
            external
          >
            View in Fireflies
          </DetailPropertyItem>
        ) : null}
      </DetailPropertyBar>

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* Main content */}
        <div className="space-y-10">
          {/* Meeting Overview — leads with the prose read of the meeting. */}
          {overviewContent || shorthandBullet ? (
            <section className="space-y-4">
              <AccordionSection label="Meeting Overview">
                {overviewContent ? (
                  <FirefliesSectionContent value={overviewContent} />
                ) : (
                  <FirefliesSectionContent value={shorthandBullet!} />
                )}
              </AccordionSection>
            </section>
          ) : null}

          {/* Tasks — AI-extracted action items, managed inline (status,
              assignee, priority, due date), with create + delete. */}
          <section>
            <AccordionSection label={`Tasks (${meetingTasks.length})`}>
              <MeetingTasksManager
                meetingId={meeting.id}
                initialTasks={meetingTasks}
                projectId={assignedProjectId}
                projects={projects}
                projectsLoading={isLoadingProjects}
                defaultSourceSystem={
                  meeting.source_system ?? meeting.type ?? "meeting"
                }
                allTasksHref={
                  assignedProjectId ? `/${assignedProjectId}/tasks` : "/tasks"
                }
              />
            </AccordionSection>
          </section>

          {/* Summary — Fireflies overview, notes, and action items grouped into one section */}
          {hasSummarySection ? (
            <section>
              <AccordionSection label="Summary" defaultOpen={false}>
                <div className="space-y-6">
                  {summaryOverviewDistinct ? (
                    <SummarySubsection label="Overview">
                      <FirefliesSectionContent value={summaryOverviewDistinct} />
                    </SummarySubsection>
                  ) : null}
                  {notesContent ? (
                    <SummarySubsection label="Notes">
                      <FirefliesSectionContent value={notesContent} />
                    </SummarySubsection>
                  ) : null}
                  {actionItemsContent ? (
                    <SummarySubsection label="Action Items">
                      <ActionItemsByAssignee content={actionItemsContent} />
                    </SummarySubsection>
                  ) : null}
                </div>
              </AccordionSection>
            </section>
          ) : null}

          {/* Discussion Topics — collapsed by default */}
          {segments.length > 0 && (
            <section>
              <AccordionSection
                label={`Discussion Topics (${segments.length})`}
                defaultOpen={false}
              >
                <div className="space-y-6">
                  {segments.map((segment, index) => (
                    <div
                      key={segment.id}
                      id={meetingSegmentAnchorId(segment.id)}
                      className="flex scroll-mt-24 gap-2.5"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                        {segment.segment_index + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        {/* eslint-disable-next-line design-system/no-raw-heading */}
                        <h3 className="text-sm font-medium text-foreground">
                          {segment.title || `Topic ${index + 1}`}
                        </h3>
                        {segment.summary && (
                          <FirefliesSectionContent value={segment.summary} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            </section>
          )}

          {/* Full Transcript */}
          {transcriptSlot ? (
            <section>
              <AccordionSection label="Full Transcript" defaultOpen={false}>
                {transcriptSlot}
              </AccordionSection>
            </section>
          ) : null}

          {/* Empty state — distinguishes a failed fetch from "never processed" */}
          {!transcriptContent && segments.length === 0 && (
            <EmptyState
              icon={<FileText />}
              title={
                transcriptLoadFailed
                  ? "Transcript could not be loaded"
                  : "No transcript available"
              }
              description={
                transcriptLoadFailed
                  ? "A transcript exists for this meeting but failed to load. Refresh to try again."
                  : "This meeting has not been processed yet."
              }
            />
          )}
        </div>

        {/* Sidebar — sticky so attendees/related/keywords stay in view while
            reading the long transcript. `lg:items-start` on the grid keeps this
            column content-height so the sticky offset engages. */}
        <aside className="space-y-8 lg:sticky lg:top-6">
          {/* Attendees */}
          {participantsList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Attendees ({participantsList.length})
              </div>
              <AttendeeAvatarStack participants={participantsList} />
            </div>
          )}

          {/* Action Snapshot */}
          {hasActionSnapshot && (
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Action Snapshot
              </div>

              {riskItems.length > 0 && (
                <div>
                  <SidebarList
                    label="Risks"
                    items={riskItems}
                    getItemKey={(risk) => risk.id}
                    renderItem={(risk) => (
                      <div className="space-y-1">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {risk.text}
                        </p>
                        {shouldShowRiskDetail(risk.text, risk.whyItMatters) ? (
                          <p className="text-xs leading-5 text-muted-foreground">
                            {risk.whyItMatters}
                          </p>
                        ) : null}
                      </div>
                    )}
                    renderItemActions={(risk, index) => (
                      <AiFeedbackControl
                        surface={
                          risk.source === "curated"
                            ? "meeting_detail_risk_card"
                            : "meeting_detail_risk"
                        }
                        subjectType={
                          risk.source === "curated"
                            ? "insight_card"
                            : "meeting_risk"
                        }
                        subjectId={risk.id}
                        projectId={assignedProjectId}
                        contentText={[risk.text, risk.whyItMatters]
                          .filter(Boolean)
                          .join("\n")}
                        contentSnapshot={{
                          meetingId: meeting.id,
                          projectId: assignedProjectId,
                          section: "action_snapshot_risks",
                          riskText: risk.text,
                          riskIndex: index,
                          meetingTitle: meeting.title,
                          riskSource: risk.source,
                          confidence: risk.confidence,
                        }}
                        reasons={MEETING_RISK_NEGATIVE_REASONS}
                        positiveReasons={MEETING_RISK_POSITIVE_REASONS}
                        collectReasonFor="both"
                        reasonInputMode="form"
                        reasonPrompt="Why is this risk useful or not useful?"
                        freeTextLabel="What should the AI know?"
                        freeTextPlaceholder="Optional example, correction, or dedupe note"
                        submitLabel="Save"
                        className="rounded-full bg-background/80"
                      />
                    )}
                  />
                </div>
              )}

              {allOpportunities.length > 0 && (
                <SidebarList label="Opportunities" items={allOpportunities} />
              )}
            </div>
          )}

          {/* Related Meetings */}
          {relatedMeetings.length > 0 && relatedMeetingsBaseHref && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Related Meetings
                </p>
                <p className="text-xs text-muted-foreground">
                  {relatedMeetings.length} recent meeting
                  {relatedMeetings.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="space-y-2">
                {relatedMeetings.map((rm) => (
                  <Link
                    key={rm.id}
                    href={`${relatedMeetingsBaseHref}/${rm.id}`}
                    className="group flex items-center gap-3 py-1.5 transition-colors"
                  >
                    {(rm.date ?? rm.created_at) ? (
                      <DateAvatar
                        date={(rm.date ?? rm.created_at)!}
                        size="sm"
                      />
                    ) : (
                      <div className="w-7 h-7 shrink-0 rounded-full bg-muted flex items-center justify-center">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {rm.title || "Untitled Meeting"}
                      </p>
                      {rm.duration_minutes ? (
                        <p className="text-xs text-muted-foreground">
                          {rm.duration_minutes} min
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Keywords */}
          {keywordList.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Keywords
              </div>
              <div className="flex flex-wrap gap-1.5">
                {visibleKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {keyword}
                  </span>
                ))}
                {hiddenKeywordCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground"
                    onClick={() => setShowAllKeywords(true)}
                  >
                    +{hiddenKeywordCount} more
                  </Button>
                )}
                {showAllKeywords && keywordList.length > KEYWORD_LIMIT && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground/70 hover:text-foreground"
                    onClick={() => setShowAllKeywords(false)}
                  >
                    Show less
                  </Button>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
      <ProjectAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        meetingTitle={meeting.title || "Untitled Meeting"}
        selectedProjectId={selectedProjectId}
        onSelectedProjectIdChange={setSelectedProjectId}
        onSave={handleSaveProjectAssignment}
        projects={projects}
        isLoadingProjects={isLoadingProjects}
        projectLoadError={projectLoadError}
        isSaving={isSavingProject}
        hasProject={Boolean(assignedProjectId)}
      />
    </PageShell>
  );
}
