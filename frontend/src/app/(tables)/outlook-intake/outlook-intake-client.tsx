"use client";

import * as React from "react";
import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Tag,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  CellDate,
  CellNumber,
  CellStatus,
  CellText,
  TruncatedCell,
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import { StatusBadge } from "@/components/ds";
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
import {
  EmailDetailPanel,
  type EmailDetailRecord,
} from "@/features/emails/email-detail-sheet";
import { apiFetch } from "@/lib/api-client";
import { useProjects } from "@/hooks/use-projects";

interface OutlookIntakeAttachment {
  id: number;
  fileName: string;
  fileSize: number | null;
  contentType: string | null;
  createdAt: string | null;
}

interface OutlookIntakeEmail {
  id: number;
  graphMessageId: string;
  mailboxUserId: string;
  documentMetadataId: string | null;
  documentStatus: string | null;
  conversationId: string | null;
  subject: string;
  body: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  fromName: string | null;
  fromEmail: string | null;
  toList: string[];
  matchStatus: string;
  assignmentMethod: string | null;
  assignmentConfidence: number | null;
  receivedAt: string | null;
  hasAttachments: boolean | null;
  webLink: string | null;
  createdAt: string | null;
  tags: string[];
  triageAction: string | null;
  triageReason: string | null;
  triageAt: string | null;
  intakeClassification: {
    action: string | null;
    category: string | null;
    confidence: number | null;
    reason: string | null;
    signals: string[];
  } | null;
  project: {
    id: number;
    name: string | null;
    projectNumber: string | null;
  } | null;
  attachments: OutlookIntakeAttachment[];
}

const columnsConfig = [
  {
    id: "subject",
    label: "Subject",
    defaultVisible: true,
    alwaysVisible: true,
  },
  { id: "from", label: "From", defaultVisible: true },
  { id: "project", label: "Project", defaultVisible: true },
  { id: "match", label: "Status", defaultVisible: true },
  { id: "tags", label: "Tags", defaultVisible: true },
  { id: "classifier", label: "Classifier", defaultVisible: true },
  { id: "triage", label: "Triage", defaultVisible: false },
  { id: "pipeline", label: "Pipeline", defaultVisible: true },
  { id: "received", label: "Date", defaultVisible: true },
  { id: "attachments", label: "Attachments", defaultVisible: true },
  { id: "mailbox", label: "Mailbox", defaultVisible: false },
];

const threadColumnsConfig = [
  {
    id: "subject",
    label: "Subject",
    defaultVisible: true,
    alwaysVisible: true,
  },
  { id: "participants", label: "Participants", defaultVisible: true },
  { id: "emailCount", label: "Emails", defaultVisible: true },
  { id: "project", label: "Project", defaultVisible: true },
  { id: "latest", label: "Latest", defaultVisible: true },
];

type PipelineInfo = {
  label: string;
  variant: "success" | "warning" | "error" | "info" | "neutral";
};

/** Map document_metadata.status → label + badge variant */
function pipelineStatus(email: OutlookIntakeEmail): PipelineInfo {
  if (!email.documentMetadataId) {
    return { label: "Not indexed", variant: "neutral" };
  }
  switch (email.documentStatus) {
    case "embedded":
    case "compiled":
    case "segmented":
      return { label: "Vectorized", variant: "success" };
    case "raw_ingested":
      return { label: "Pending", variant: "warning" };
    case "skipped_low_content":
      return { label: "Too short", variant: "neutral" };
    case "metadata_only":
      return { label: "Metadata only", variant: "neutral" };
    case "missing_metadata":
      return { label: "Metadata missing", variant: "error" };
    case "error":
      return { label: "Error", variant: "error" };
    default:
      return { label: "Indexed", variant: "info" };
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function senderLabel(email: OutlookIntakeEmail): string {
  if (email.fromName && email.fromEmail)
    return `${email.fromName} <${email.fromEmail}>`;
  return email.fromName || email.fromEmail || "Unknown sender";
}

function projectLabel(project: OutlookIntakeEmail["project"]): string | null {
  if (!project) return null;
  if (project.projectNumber && project.name)
    return `${project.projectNumber} - ${project.name}`;
  return project.projectNumber || project.name || `Project ${project.id}`;
}

function outlookIntakeToDetailRecord(
  email: OutlookIntakeEmail,
): EmailDetailRecord {
  const { label: pipelineLabel } = pipelineStatus(email);

  return {
    id: String(email.id),
    subject: email.subject,
    body: email.body,
    bodyHtml: email.bodyHtml,
    bodyText: email.bodyText,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    toList: email.toList,
    status: email.matchStatus,
    receivedAt: email.receivedAt,
    createdAt: email.createdAt,
    hasAttachments: email.hasAttachments || email.attachments.length > 0,
    projectLabel: projectLabel(email.project),
    sourceLabel: "Outlook intake",
    webLink: email.webLink,
    relatedLabel: pipelineLabel,
  };
}

interface InlineProjectSelectProps {
  emailId: number;
  project: OutlookIntakeEmail["project"];
  onSaved: () => void;
}

function InlineProjectSelect({
  emailId,
  project,
  onSaved,
}: InlineProjectSelectProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const { projects, isLoading } = useProjects({ enabled: open });

  async function handleSelect(projectId: number | null) {
    if (projectId === (project?.id ?? null)) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/outlook-intake/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      toast.success(projectId ? "Project assigned" : "Assignment cleared");
      onSaved();
    } catch (err) {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  const label = project
    ? project.projectNumber
      ? `${project.projectNumber} — ${project.name ?? ""}`
      : (project.name ?? `Project ${project.id}`)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          // DESIGN-SYSTEM EXCEPTION: this is an interactive assignment control inside a table cell.
          // Promote to a shared EditableProjectCell primitive before reusing this pattern elsewhere.
          className="flex min-w-0 w-56 justify-start gap-1.5 px-2 font-normal"
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
          )}
          <span
            className={
              label
                ? "truncate font-medium text-foreground"
                : "text-muted-foreground"
            }
          >
            {label ?? "Assign project…"}
          </span>
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
              {project && (
                <CommandItem
                  value="__unassign__"
                  onSelect={() => handleSelect(null)}
                  className="text-muted-foreground"
                >
                  <X className="mr-2 size-3.5" />
                  Clear assignment
                </CommandItem>
              )}
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.project_number ?? ""} ${p.name ?? ""}`}
                  onSelect={() => handleSelect(p.id)}
                >
                  <Check
                    className={`mr-2 size-3.5 ${p.id === project?.id ? "opacity-100" : "opacity-0"}`}
                  />
                  <span className="truncate">
                    {p.project_number ? (
                      <>
                        <span className="font-medium">{p.project_number}</span>{" "}
                        — {p.name}
                      </>
                    ) : (
                      (p.name ?? `Project ${p.id}`)
                    )}
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

// ── Thread / conversation view ────────────────────────────────────────────────

interface ThreadGroup {
  conversationId: string;
  subject: string;
  emailCount: number;
  participants: string[];
  latestDate: string | null;
  emails: OutlookIntakeEmail[];
}

function groupByConversation(emails: OutlookIntakeEmail[]): ThreadGroup[] {
  const map = new Map<string, OutlookIntakeEmail[]>();
  const noThread: OutlookIntakeEmail[] = [];

  for (const email of emails) {
    const key = email.conversationId ?? null;
    if (!key) {
      noThread.push(email);
      continue;
    }
    const group = map.get(key) ?? [];
    group.push(email);
    map.set(key, group);
  }

  const threads: ThreadGroup[] = [];

  map.forEach((msgs, cid) => {
    // Sort within thread oldest→newest
    const sorted = [...msgs].sort((a, b) =>
      (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""),
    );
    const latest = sorted[sorted.length - 1];
    const seen = new Set<string>();
    const participants: string[] = [];
    for (const m of sorted) {
      const name = m.fromName ?? m.fromEmail ?? "";
      if (name && !seen.has(name)) {
        seen.add(name);
        participants.push(name);
      }
    }
    threads.push({
      conversationId: cid,
      subject: latest.subject,
      emailCount: sorted.length,
      participants,
      latestDate: latest.receivedAt,
      emails: sorted.reverse(), // newest first when expanded
    });
  });

  // Solo emails (no conversation_id) each become their own thread
  for (const email of noThread) {
    threads.push({
      conversationId: email.id.toString(),
      subject: email.subject,
      emailCount: 1,
      participants: [email.fromName ?? email.fromEmail ?? ""],
      latestDate: email.receivedAt,
      emails: [email],
    });
  }

  // Sort threads by latest date desc
  return threads.sort((a, b) =>
    (b.latestDate ?? "").localeCompare(a.latestDate ?? ""),
  );
}

type OutlookIntakeClientProps = {
  unassigned?: boolean;
  embedded?: boolean;
  navigationTabs?: {
    label: string;
    href: string;
    count?: number;
    isActive?: boolean;
    testId?: string;
    countTestId?: string;
  }[];
  viewMode?: "table" | "threads";
  classificationAction?: "import" | "quarantine";
};

export function OutlookIntakeClient({
  unassigned,
  embedded,
  navigationTabs,
  viewMode = "table",
  classificationAction,
}: OutlookIntakeClientProps = {}): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname()! ?? "/outlook-intake";
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [threadView, setThreadView] = React.useState(viewMode === "threads");
  const isThreadOnly = viewMode === "threads";
  const [selectedEmail, setSelectedEmail] =
    React.useState<OutlookIntakeEmail | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isBulkActing, setIsBulkActing] = React.useState(false);
  const initialMatchStatus = searchParams?.get("match_status") ?? "";
  const initialClassificationAction =
    classificationAction ?? searchParams?.get("classification_action") ?? "";
  const initialSentFrom = searchParams?.get("sent_from") ?? "";
  const initialSentTo = searchParams?.get("sent_to") ?? "";
  const initialTag = searchParams?.get("tag") ?? "";
  const initialTriageAction = searchParams?.get("triage_action") ?? "";

  React.useEffect(() => {
    if (isThreadOnly) setThreadView(true);
  }, [isThreadOnly]);

  const tableState = useUnifiedTableState({
    entityKey: isThreadOnly ? "outlook-intake-threads" : "outlook-intake",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      page: 1,
      perPage: 25,
      search: "",
      sortBy: isThreadOnly ? "latest" : "received",
      sortDirection: "desc",
      visibleColumns: (isThreadOnly ? threadColumnsConfig : columnsConfig)
        .filter((c) => c.defaultVisible !== false)
        .map((c) => c.id),
      filters: {
        match_status: initialMatchStatus || undefined,
        classification_action: initialClassificationAction || undefined,
        sent_from: initialSentFrom || undefined,
        sent_to: initialSentTo || undefined,
        tag: initialTag || undefined,
        triage_action: initialTriageAction || undefined,
      },
    },
  });

  const matchStatus = tableState.activeFilters.match_status as
    | string
    | undefined;
  const classifierFilter = tableState.activeFilters.classification_action as
    | string
    | undefined;
  const vectorizedFilter = tableState.activeFilters.vectorized as
    | string
    | undefined;
  const sentFromFilter = tableState.activeFilters.sent_from as
    | string
    | undefined;
  const sentToFilter = tableState.activeFilters.sent_to as string | undefined;
  const tagFilter = tableState.activeFilters.tag as string | undefined;
  const triageFilter = tableState.activeFilters.triage_action as
    | string
    | undefined;
  const params = new URLSearchParams();
  if (matchStatus) params.set("match_status", matchStatus);
  if (classifierFilter) params.set("classification_action", classifierFilter);
  if (sentFromFilter) params.set("sent_from", sentFromFilter);
  if (sentToFilter) params.set("sent_to", sentToFilter);
  if (tagFilter) params.set("tag", tagFilter);
  if (triageFilter) params.set("triage_action", triageFilter);
  if (unassigned) params.set("unassigned", "true");
  const queryString = params.toString();

  const {
    data = [],
    isLoading,
    error,
  } = useQuery<OutlookIntakeEmail[]>({
    queryKey: [
      "outlook-intake",
      matchStatus ?? "",
      classifierFilter ?? "",
      sentFromFilter ?? "",
      sentToFilter ?? "",
      tagFilter ?? "",
      triageFilter ?? "",
      unassigned ? "unassigned" : "all",
    ],
    queryFn: ({ signal }) =>
      apiFetch<OutlookIntakeEmail[]>(
        `/api/outlook-intake${queryString ? `?${queryString}` : ""}`,
        { signal },
      ),
  });

  const searchTerm = tableState.debouncedSearch.trim().toLowerCase();
  const filtered = data.filter((email) => {
    if (vectorizedFilter === "yes" && !email.documentMetadataId) return false;
    if (vectorizedFilter === "no" && email.documentMetadataId) return false;
    if (!searchTerm) return true;
    const fields = [
      email.subject,
      senderLabel(email),
      email.mailboxUserId,
      email.toList.join(" "),
      email.tags.join(" "),
      email.triageAction ?? "",
      email.project?.name ?? "",
      email.project?.projectNumber ?? "",
      email.attachments.map((attachment) => attachment.fileName).join(" "),
    ];
    return fields.some((field) => field.toLowerCase().includes(searchTerm));
  });

  const threadGroups = React.useMemo(
    () => groupByConversation(filtered),
    [filtered],
  );

  const threadColumns = React.useMemo<TableColumn<ThreadGroup>[]>(
    () => [
      {
        id: "subject",
        label: "Subject",
        width: 360,
        render: (thread) => (
          <TruncatedCell value={thread.subject} maxWidth={340} />
        ),
        sortable: true,
        sortValue: (thread) => thread.subject,
      },
      {
        id: "participants",
        label: "Participants",
        width: 320,
        render: (thread) => (
          <TruncatedCell
            value={thread.participants.join(", ")}
            maxWidth={300}
          />
        ),
        sortable: true,
        sortValue: (thread) => thread.participants.join(", "),
      },
      {
        id: "emailCount",
        label: "Emails",
        width: 90,
        render: (thread) => <CellNumber value={thread.emailCount} muted />,
        sortable: true,
        sortValue: (thread) => thread.emailCount,
      },
      {
        id: "project",
        label: "Project",
        width: 220,
        render: (thread) => (
          <CellText value={projectLabel(thread.emails[0]?.project)} muted />
        ),
        sortable: true,
        sortValue: (thread) => projectLabel(thread.emails[0]?.project) ?? "",
      },
      {
        id: "latest",
        label: "Latest",
        width: 180,
        render: (thread) => <CellDate value={thread.latestDate} showTime />,
        sortable: true,
        sortValue: (thread) => thread.latestDate ?? "",
      },
    ],
    [],
  );

  const columns = React.useMemo<TableColumn<OutlookIntakeEmail>[]>(
    () => [
      {
        id: "subject",
        label: "Subject",
        width: 300,
        render: (email) => (
          <TruncatedCell value={email.subject} maxWidth={280} />
        ),
        sortable: true,
        sortValue: (email) => email.subject,
      },
      {
        id: "from",
        label: "From",
        width: 180,
        render: (email) => <CellText value={senderLabel(email)} muted />,
        sortable: true,
        sortValue: (email) => email.fromName ?? email.fromEmail ?? "",
      },
      {
        id: "project",
        label: "Project",
        width: 220,
        render: (email) => (
          <InlineProjectSelect
            emailId={email.id}
            project={email.project}
            onSaved={() =>
              queryClient.invalidateQueries({ queryKey: ["outlook-intake"] })
            }
          />
        ),
        sortable: true,
        sortValue: (email) => email.project?.name ?? "",
      },
      {
        id: "match",
        label: "Status",
        width: 120,
        render: (email) => <CellStatus value={email.matchStatus} />,
        sortable: true,
        sortValue: (email) => email.matchStatus,
      },
      {
        id: "tags",
        label: "Tags",
        width: 180,
        render: (email) => (
          <CellText
            value={email.tags.length > 0 ? email.tags.join(", ") : null}
            muted
          />
        ),
        sortable: true,
        sortValue: (email) => email.tags.join(", "),
      },
      {
        id: "classifier",
        label: "Classifier",
        width: 150,
        render: (email) => {
          const classification = email.intakeClassification;
          if (!classification?.action) {
            return <StatusBadge status="Not classified" variant="neutral" />;
          }
          const variant =
            classification.action === "quarantine" ? "warning" : "neutral";
          const label =
            classification.action === "quarantine"
              ? "Quarantine"
              : classification.action === "import"
                ? "Import"
                : classification.action;
          return <StatusBadge status={label} variant={variant} />;
        },
        sortable: true,
        sortValue: (email) => email.intakeClassification?.action ?? "",
      },
      {
        id: "triage",
        label: "Triage",
        width: 130,
        render: (email) => (
          <CellText value={email.triageAction ?? null} muted />
        ),
        sortable: true,
        sortValue: (email) => email.triageAction ?? "",
      },
      {
        id: "pipeline",
        label: "Pipeline",
        width: 130,
        render: (email) => {
          const { label, variant } = pipelineStatus(email);
          return <StatusBadge status={label} variant={variant} />;
        },
        sortable: true,
        sortValue: (email) => pipelineStatus(email).label,
      },
      {
        id: "received",
        label: "Date",
        width: 180,
        render: (email) => (
          <CellDate value={email.receivedAt || email.createdAt} showTime />
        ),
        sortable: true,
        sortValue: (email) => email.receivedAt || email.createdAt || "",
      },
      {
        id: "attachments",
        label: "Attachments",
        width: 100,
        render: (email) =>
          email.attachments.length > 0 ? (
            <CellNumber value={email.attachments.length} muted />
          ) : (
            <CellText value={null} muted />
          ),
        sortable: true,
        sortValue: (email) => email.attachments.length,
      },
      {
        id: "mailbox",
        label: "Mailbox",
        width: 180,
        render: (email) => <CellText value={email.mailboxUserId} muted />,
        sortable: true,
        sortValue: (email) => email.mailboxUserId,
      },
    ],
    [queryClient],
  );

  const sorted = React.useMemo(() => {
    const sortColumn = columns.find(
      (column) => column.id === tableState.sortBy,
    );
    const sortValue = sortColumn?.sortValue;
    if (!sortValue) return filtered;

    return [...filtered].sort((left, right) => {
      const leftValue = sortValue(left);
      const rightValue = sortValue(right);
      const comparison = String(leftValue ?? "").localeCompare(
        String(rightValue ?? ""),
      );
      return tableState.sortDirection === "asc" ? comparison : -comparison;
    });
  }, [columns, filtered, tableState.sortBy, tableState.sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / tableState.perPage));
  const pageStart = (tableState.page - 1) * tableState.perPage;
  const paged = sorted.slice(pageStart, pageStart + tableState.perPage);

  const updateFilters = (
    next: Record<
      string,
      string | number | boolean | string[] | null | undefined
    >,
  ) => {
    tableState.setActiveFilters(next);
    tableState.setSearchParams({
      match_status: (next.match_status ?? null) as string | null,
      classification_action: (next.classification_action ?? null) as
        | string
        | null,
      vectorized: (next.vectorized ?? null) as string | null,
      sent_from: (next.sent_from ?? null) as string | null,
      sent_to: (next.sent_to ?? null) as string | null,
      tag: (next.tag ?? null) as string | null,
      triage_action: (next.triage_action ?? null) as string | null,
      page: "1",
    });
    tableState.setPage(1);
  };

  async function handleBulkMarkFiltered() {
    if (selectedIds.length === 0) return;
    setIsBulkActing(true);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          apiFetch(`/api/outlook-intake/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ match_status: "ignored" }),
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;
      if (succeeded > 0)
        toast.success(
          `${succeeded} email${succeeded !== 1 ? "s" : ""} marked as filtered`,
        );
      if (failed > 0)
        toast.error(
          `${failed} email${failed !== 1 ? "s" : ""} failed to update`,
        );
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["outlook-intake"] });
    } finally {
      setIsBulkActing(false);
    }
  }

  async function saveTags(emailId: number, tags: string[]) {
    await apiFetch(`/api/outlook-intake/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_tags: tags }),
    });
    void queryClient.invalidateQueries({ queryKey: ["outlook-intake"] });
  }

  async function promptAndSaveTags(email: OutlookIntakeEmail) {
    const nextValue = window.prompt(
      "Tags, separated by commas",
      email.tags.join(", "),
    );
    if (nextValue === null) return;
    const nextTags = [
      ...new Set(
        nextValue
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
    ];
    try {
      await saveTags(email.id, nextTags);
      toast.success(nextTags.length > 0 ? "Tags updated" : "Tags cleared");
    } catch (err) {
      toast.error("Failed to update tags");
    }
  }

  async function handleBulkTagSelected() {
    if (selectedIds.length === 0) return;
    const tag = window.prompt("Add tag to selected emails");
    const normalizedTag = tag?.trim();
    if (!normalizedTag) return;

    const selectedEmails = data.filter((email) =>
      selectedIds.includes(String(email.id)),
    );
    setIsBulkActing(true);
    try {
      const results = await Promise.allSettled(
        selectedEmails.map((email) =>
          saveTags(email.id, [...new Set([...email.tags, normalizedTag])]),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      const succeeded = results.length - failed;
      if (succeeded > 0)
        toast.success(
          `${succeeded} email${succeeded !== 1 ? "s" : ""} tagged`,
        );
      if (failed > 0)
        toast.error(
          `${failed} email${failed !== 1 ? "s" : ""} failed to update`,
        );
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["outlook-intake"] });
    } finally {
      setIsBulkActing(false);
    }
  }

  async function handleBulkReclassify() {
    if (selectedIds.length === 0) return;
    setIsBulkActing(true);
    try {
      const result = await apiFetch<{
        scanned?: number;
        updated?: number;
      }>("/api/outlook-intake/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeIds: selectedIds.map((id) => Number.parseInt(id, 10)),
          apply: true,
        }),
      });
      toast.success(
        `Reclassified ${result.scanned ?? selectedIds.length} email${(result.scanned ?? selectedIds.length) === 1 ? "" : "s"}; ${result.updated ?? 0} updated`,
      );
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["outlook-intake"] });
    } catch (err) {
      toast.error("Failed to reclassify selected emails");
    } finally {
      setIsBulkActing(false);
    }
  }

  async function handleReclassifyEmail(emailId: number) {
    try {
      const result = await apiFetch<{
        scanned?: number;
        updated?: number;
      }>("/api/outlook-intake/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeIds: [emailId],
          apply: true,
        }),
      });
      toast.success(
        `Email reclassified; ${result.updated ?? 0} update${(result.updated ?? 0) === 1 ? "" : "s"} applied`,
      );
      void queryClient.invalidateQueries({ queryKey: ["outlook-intake"] });
    } catch (err) {
      toast.error("Failed to reclassify email");
    }
  }

  const threadToggle = isThreadOnly ? null : (
    <Button
      size="sm"
      variant={threadView ? "default" : "outline"}
      onClick={() => setThreadView((v) => !v)}
      aria-pressed={threadView}
    >
      <MessageSquare className="mr-1.5 size-3.5" />
      Threads
    </Button>
  );

  // ── Thread view ──────────────────────────────────────────────────────────────
  if (threadView) {
    const threadSortColumn = threadColumns.find(
      (column) => column.id === tableState.sortBy,
    );
    const getThreadSortValue = threadSortColumn?.sortValue;
    const sortedThreads = getThreadSortValue
      ? [...threadGroups].sort((left, right) => {
          const leftValue = getThreadSortValue(left);
          const rightValue = getThreadSortValue(right);
          const comparison = String(leftValue ?? "").localeCompare(
            String(rightValue ?? ""),
          );
          return tableState.sortDirection === "asc" ? comparison : -comparison;
        })
      : threadGroups;
    const threadTotalPages = Math.max(
      1,
      Math.ceil(sortedThreads.length / tableState.perPage),
    );
    const threadPageStart = (tableState.page - 1) * tableState.perPage;
    const pagedThreads = sortedThreads.slice(
      threadPageStart,
      threadPageStart + tableState.perPage,
    );

    return (
      <UnifiedTablePage
        header={
          embedded
            ? { title: "", variant: "compact" }
            : {
                title: "Outlook Threads",
                description: "Synced Outlook conversations grouped by thread.",
              }
        }
        tabs={navigationTabs}
        toolbar={{
          totalItems: threadGroups.length,
          filteredItems: threadGroups.length,
          selectedCount: 0,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search threads...",
          currentView: "table",
          onViewChange: () => undefined,
          enabledViews: ["table"],
          filters: [
            {
              id: "sent_from",
              label: "From",
              type: "text",
              placeholder: "name or email",
            },
            {
              id: "sent_to",
              label: "To",
              type: "text",
              placeholder: "email",
            },
            {
              id: "tag",
              label: "Tag",
              type: "text",
              placeholder: "tag",
            },
            {
              id: "triage_action",
              label: "Triage",
              type: "select",
              options: [
                { value: "urgent", label: "Urgent" },
                { value: "reply_needed", label: "Reply needed" },
                { value: "delegate", label: "Delegate" },
                { value: "fyi", label: "FYI" },
                { value: "delete", label: "Delete" },
                { value: "watch", label: "Watch" },
              ],
            },
            {
              id: "match_status",
              label: "Match",
              type: "select",
              options: [
                { value: "matched", label: "Matched" },
                { value: "unmatched", label: "Unmatched" },
                { value: "ignored", label: "Filtered" },
              ],
            },
            {
              id: "classification_action",
              label: "Classifier",
              type: "select",
              options: [
                { value: "import", label: "Import" },
                { value: "quarantine", label: "Quarantine" },
              ],
            },
            {
              id: "vectorized",
              label: "Vectorized",
              type: "select",
              options: [
                { value: "yes", label: "Indexed" },
                { value: "no", label: "Not Indexed" },
              ],
            },
          ],
          activeFilters: tableState.activeFilters,
          onFilterChange: updateFilters,
          onClearFilters: () => updateFilters({}),
          columns: threadColumnsConfig,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: pagedThreads,
          isLoading,
          error: error instanceof Error ? error : null,
        }}
        table={{
          columns: threadColumns,
          getRowId: (thread) => thread.conversationId,
          activeRowId: selectedEmail
            ? (selectedEmail.conversationId ?? String(selectedEmail.id))
            : null,
          onRowClick: (thread) => setSelectedEmail(thread.emails[0] ?? null),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({
              sort: sortBy,
              sort_dir: direction,
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
        emptyState={{
          title: "No threads found",
          description: "No synced Outlook conversations are stored yet.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered:
            Boolean(tableState.searchInput) ||
            Boolean(matchStatus) ||
            Boolean(classifierFilter) ||
            Boolean(sentFromFilter) ||
            Boolean(sentToFilter) ||
            Boolean(tagFilter) ||
            Boolean(triageFilter),
          icon: <MessageSquare className="size-10 text-muted-foreground" />,
        }}
        pagination={{
          page: tableState.page,
          totalPages: threadTotalPages,
          perPage: tableState.perPage,
          onPageChange: (nextPage) => {
            tableState.setPage(nextPage);
            tableState.setSearchParams({ page: String(nextPage) });
          },
          onPerPageChange: (nextPerPage) => {
            const parsed = Number(nextPerPage);
            if (!Number.isFinite(parsed) || parsed <= 0) return;
            tableState.setPerPage(parsed);
            tableState.setSearchParams({ per_page: String(parsed), page: "1" });
            tableState.setPage(1);
          },
        }}
        sidePanel={
          selectedEmail
            ? {
                content: (
                  <EmailDetailPanel
                    email={outlookIntakeToDetailRecord(selectedEmail)}
                    onClose={() => setSelectedEmail(null)}
                  />
                ),
                variant: "wide",
                defaultWidth: 560,
                minWidth: 440,
                storageKey: "outlook-thread-detail",
                onClose: () => setSelectedEmail(null),
              }
            : undefined
        }
      />
    );
  }

  // ── Standard table view ───────────────────────────────────────────────────────
  return (
    <>
      <UnifiedTablePage
        header={
          embedded
            ? { title: "", variant: "compact" }
            : {
                title: "Outlook Intake",
                description:
                  "All synced Outlook emails and attachments before and after project matching.",
                actions: (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/emails">
                      <Mail />
                      Project Emails
                    </Link>
                  </Button>
                ),
              }
        }
        tabs={navigationTabs}
        toolbar={{
          totalItems: data.length,
          filteredItems: threadView
            ? groupByConversation(filtered).length
            : filtered.length,
          selectedCount: selectedIds.length,
          searchValue: tableState.searchInput,
          onSearchChange: tableState.setSearchInput,
          searchPlaceholder: "Search Outlook intake...",
          customActions: embedded ? null : (
            <>
              {selectedIds.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground"
                    disabled={isBulkActing}
                    onClick={handleBulkReclassify}
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Reclassify {selectedIds.length}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground"
                    disabled={isBulkActing}
                    onClick={handleBulkTagSelected}
                  >
                    <Tag className="mr-1.5 size-3.5" />
                    Tag {selectedIds.length}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-muted-foreground"
                    disabled={isBulkActing}
                    onClick={handleBulkMarkFiltered}
                  >
                    <Ban className="mr-1.5 size-3.5" />
                    Filter {selectedIds.length} selected
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant={threadView ? "default" : "outline"}
                onClick={() => setThreadView((v) => !v)}
                aria-pressed={threadView}
              >
                <MessageSquare className="mr-1.5 size-3.5" />
                Threads
              </Button>
            </>
          ),
          currentView: tableState.currentView,
          onViewChange: (view) => {
            tableState.setCurrentView(view);
            tableState.setSearchParams({ view });
          },
          filters: [
            {
              id: "sent_from",
              label: "From",
              type: "text",
              placeholder: "name or email",
            },
            {
              id: "sent_to",
              label: "To",
              type: "text",
              placeholder: "email",
            },
            {
              id: "tag",
              label: "Tag",
              type: "text",
              placeholder: "tag",
            },
            {
              id: "triage_action",
              label: "Triage",
              type: "select",
              options: [
                { label: "Urgent", value: "urgent" },
                { label: "Reply needed", value: "reply_needed" },
                { label: "Delegate", value: "delegate" },
                { label: "FYI", value: "fyi" },
                { label: "Delete", value: "delete" },
                { label: "Watch", value: "watch" },
              ],
            },
            {
              id: "match_status",
              label: "Match",
              type: "select",
              options: [
                { label: "Unassigned", value: "unassigned" },
                { label: "Matched", value: "matched" },
                { label: "Ignored", value: "ignored" },
                { label: "Error", value: "error" },
              ],
            },
            {
              id: "classification_action",
              label: "Classifier",
              type: "select",
              options: [
                { label: "Import", value: "import" },
                { label: "Quarantine", value: "quarantine" },
              ],
            },
            {
              id: "vectorized",
              label: "Vectorized",
              type: "select",
              options: [
                { label: "Yes", value: "yes" },
                { label: "No", value: "no" },
              ],
            },
          ],
          activeFilters: tableState.activeFilters,
          onFilterChange: (filters) =>
            updateFilters({
              match_status: filters.match_status as string | undefined,
              classification_action: filters.classification_action as
                | string
                | undefined,
              vectorized: filters.vectorized as string | undefined,
              sent_from: filters.sent_from as string | undefined,
              sent_to: filters.sent_to as string | undefined,
              tag: filters.tag as string | undefined,
              triage_action: filters.triage_action as string | undefined,
            }),
          onClearFilters: () => updateFilters({}),
          columns: columnsConfig,
          visibleColumns: tableState.visibleColumns,
          onColumnVisibilityChange: tableState.setVisibleColumns,
        }}
        data={{
          items: paged,
          isLoading,
          error: error ?? undefined,
        }}
        table={{
          density: "compact",
          columns,
          getRowId: (email) => String(email.id),
          activeRowId: selectedEmail ? String(selectedEmail.id) : null,
          onRowClick: (email) => {
            setSelectedEmail(email);
          },
          rowActions: (email) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Row actions">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {email.webLink ? (
                  <DropdownMenuItem asChild>
                    <a href={email.webLink} target="_blank" rel="noreferrer">
                      <ArrowRight className="mr-2 size-4" />
                      Open in Outlook
                    </a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="text-muted-foreground"
                  onClick={() => void promptAndSaveTags(email)}
                >
                  <Tag className="mr-2 size-4" />
                  Edit tags
                </DropdownMenuItem>
                {email.matchStatus !== "ignored" ? (
                  <>
                    <DropdownMenuItem
                      className="text-muted-foreground"
                      onClick={() => void handleReclassifyEmail(email.id)}
                    >
                      <RefreshCw className="mr-2 size-4" />
                      Reclassify
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-muted-foreground"
                      onClick={async () => {
                        try {
                          await apiFetch(`/api/outlook-intake/${email.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ match_status: "ignored" }),
                          });
                          toast.success("Email marked as filtered");
                          void queryClient.invalidateQueries({
                            queryKey: ["outlook-intake"],
                          });
                        } catch (err) {
                          toast.error("Failed to update");
                        }
                      }}
                    >
                      <Ban className="mr-2 size-4" />
                      Filter as unimportant
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    className="text-muted-foreground"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/outlook-intake/${email.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ match_status: "unassigned" }),
                        });
                        toast.success("Email restored");
                        void queryClient.invalidateQueries({
                          queryKey: ["outlook-intake"],
                        });
                      } catch (err) {
                        toast.error("Failed to update");
                      }
                    }}
                  >
                    <X className="mr-2 size-4" />
                    Remove filter
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }}
        selection={{
          selectedIds,
          onSelectAll: (checked) =>
            setSelectedIds(checked ? paged.map((e) => String(e.id)) : []),
          onSelectRow: (id, checked) =>
            setSelectedIds((prev) =>
              checked ? [...prev, id] : prev.filter((x) => x !== id),
            ),
        }}
        sorting={{
          sortBy: tableState.sortBy,
          sortDirection: tableState.sortDirection,
          onSortChange: (sortBy, direction) => {
            tableState.setSortBy(sortBy);
            tableState.setSortDirection(direction);
            tableState.setSearchParams({
              sort: sortBy,
              sort_dir: direction,
              page: "1",
            });
            tableState.setPage(1);
          },
        }}
        views={{
          list: (email) => (
            <div
              className="space-y-2 border-b px-4 py-3"
              onClick={() => {
                setSelectedEmail(email);
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{email.subject}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {senderLabel(email)}
                  </div>
                </div>
                <StatusBadge status={email.matchStatus} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{email.attachments.length} attachments</span>
                <span>{email.project?.name ?? "Unassigned"}</span>
                {email.tags.length > 0 ? <span>{email.tags.join(", ")}</span> : null}
                <span>{formatDate(email.receivedAt || email.createdAt)}</span>
              </div>
            </div>
          ),
        }}
        emptyState={{
          title: "No Outlook intake found",
          description: "No synced Outlook intake records are stored yet.",
          filteredDescription: "Try adjusting your search or filters.",
          isFiltered:
            Boolean(tableState.searchInput) ||
            Boolean(matchStatus) ||
            Boolean(classifierFilter) ||
            Boolean(sentFromFilter) ||
            Boolean(sentToFilter) ||
            Boolean(tagFilter) ||
            Boolean(triageFilter),
          icon: <Inbox className="size-10 text-muted-foreground" />,
        }}
        pagination={{
          page: tableState.page,
          totalPages,
          perPage: tableState.perPage,
          onPageChange: (page) => {
            tableState.setPage(page);
            tableState.setSearchParams({ page: String(page) });
          },
          onPerPageChange: (perPage) => {
            tableState.setPerPage(Number(perPage));
            tableState.setPage(1);
            tableState.setSearchParams({ per_page: perPage, page: "1" });
          },
        }}
        layout={{
          fullBleedTable: false,
          containerPadding: !embedded,
        }}
        sidePanel={
          selectedEmail
            ? {
                content: (
                  <EmailDetailPanel
                    email={outlookIntakeToDetailRecord(selectedEmail)}
                    onClose={() => setSelectedEmail(null)}
                  />
                ),
                variant: "wide",
                defaultWidth: 680,
                minWidth: 520,
                storageKey: "outlook-intake-email-detail",
                onClose: () => setSelectedEmail(null),
              }
            : undefined
        }
      />
    </>
  );
}
