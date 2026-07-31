"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  CellDate,
  CellStatus,
  UnifiedTablePage,
  useUnifiedTableState,
  type TableColumn,
} from "@/components/tables/unified";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { MeetingsTablePage } from "@/features/meetings/meetings-table-page";
import type { Meeting } from "@/lib/validation/meetings";
import type { DailyBriefFanoutReadback, DailyBriefSourceContent } from "@/lib/daily-briefs/fanout-readback";

const SOURCE_TABS: Array<{ id: DailyBriefSourceContent["lane"] | "all"; label: string }> = [
  { id: "meetings", label: "Meetings" },
  { id: "teams", label: "Team messages" },
  { id: "emails", label: "Emails" },
  { id: "documents", label: "Documents" },
  { id: "all", label: "All sources" },
];

type SourceTab = (typeof SOURCE_TABS)[number]["id"];
const NO_PROJECT_VALUE = "__none__";

function toMeeting(source: DailyBriefSourceContent): Meeting {
  return {
    id: source.id,
    title: source.title,
    date: source.sourceAt,
    type: "meeting",
    project: source.projectName,
    project_id: source.projectId,
    content: source.content,
    source: "daily_brief",
    url: source.url,
    summary: null,
    overview: null,
    description: null,
    participants: null,
    participants_array: null,
    action_items: null,
    bullet_points: null,
    keywords: null,
    category: null,
    status: null,
    duration_minutes: null,
    embedding_status: null,
    created_at: source.sourceAt,
  };
}

function ProjectSelectEditor({
  item,
  allProjects,
  onChange,
  onCancel,
  onProjectEdit,
}: {
  item: DailyBriefSourceContent;
  allProjects: DailyBriefFanoutReadback["allProjects"];
  onChange: (value: string) => void;
  onCancel: () => void;
  onProjectEdit: (item: DailyBriefSourceContent, projectName: string, projectId: number | null) => Promise<void>;
}) {
  const isOpenRef = React.useRef(false);
  const currentProjectId = item.projectId?.toString() ?? NO_PROJECT_VALUE;

  return <Select
    defaultValue={currentProjectId}
    onOpenChange={(open) => { isOpenRef.current = open; }}
    onValueChange={(value) => {
      if (value === NO_PROJECT_VALUE) {
        onChange("");
        void onProjectEdit(item, "", null).finally(onCancel);
        return;
      }
      const projectId = Number(value);
      const selected = allProjects.find((project) => project.id === projectId);
      const name = selected?.name ?? "";
      onChange(name);
      void onProjectEdit(item, name, projectId).finally(onCancel);
    }}
  >
    <SelectTrigger
      autoFocus
      className="-my-0.5 h-7 w-full text-sm"
      onBlur={() => { if (!isOpenRef.current) onCancel(); }}
      onKeyDown={(event) => { if (event.key === "Escape") onCancel(); }}
    >
      <SelectValue placeholder="— None —" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value={NO_PROJECT_VALUE}>— None —</SelectItem>
      {allProjects.map((project) => <SelectItem key={project.id} value={project.id.toString()}>{project.name}</SelectItem>)}
    </SelectContent>
  </Select>;
}

function SourceTable({ sources, allProjects }: { sources: DailyBriefSourceContent[]; allProjects: DailyBriefFanoutReadback["allProjects"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editableSources, setEditableSources] = React.useState(sources);
  const activeTab = (searchParams.get("lane") as SourceTab | null) ?? "meetings";
  const selectedTab = SOURCE_TABS.some((tab) => tab.id === activeTab) ? activeTab : "meetings";

  React.useEffect(() => setEditableSources(sources), [sources]);

  const handleProjectEdit = React.useCallback(async (item: DailyBriefSourceContent, projectName: string, projectId: number | null) => {
    const supabase = createClient();
    const { error } = await supabase.from("document_metadata").update({ project: projectName || null, project_id: projectId }).eq("id", item.id);
    if (error) {
      toast.error("Failed to update project", { description: error.message });
      throw error;
    }
    setEditableSources((current) => current.map((source) => source.id === item.id ? { ...source, projectName: projectName || null, projectId } : source));
  }, []);
  const tableState = useUnifiedTableState({
    entityKey: "daily-brief-fanout-sources",
    searchParams,
    pathname,
    router,
    defaults: {
      view: "table",
      allowedViews: ["table"],
      page: 1,
      perPage: 25,
      search: "",
      sortBy: "sourceAt",
      sortDirection: "desc",
      visibleColumns: ["title", "type", "project", "sourceAt", "original"],
      filters: {},
    },
  });

  const filteredSources = React.useMemo(() => {
    const tabSources = selectedTab === "all" ? editableSources : editableSources.filter((source) => source.lane === selectedTab);
    const search = tableState.debouncedSearch.trim().toLowerCase();
    if (!search) return tabSources;
    return tabSources.filter((source) => [source.title, source.projectName ?? "", source.content].join(" ").toLowerCase().includes(search));
  }, [selectedTab, editableSources, tableState.debouncedSearch]);

  const columns = React.useMemo<TableColumn<DailyBriefSourceContent>[]>(() => [
    {
      id: "title",
      label: "Source",
      alwaysVisible: true,
      sortable: true,
      sortValue: (item) => item.title,
      render: (item) => <a href={`/document-metadata?recordId=${encodeURIComponent(item.id)}`} className="font-medium text-foreground underline-offset-4 hover:underline">{item.title}</a>,
      csvValue: (item) => item.title,
      width: 320,
    },
    {
      id: "type",
      label: "Type",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.lane,
      render: (item) => <span className="text-sm capitalize text-muted-foreground">{item.lane === "teams" ? "Team message" : item.lane.slice(0, -1)}</span>,
      csvValue: (item) => item.lane,
      width: 150,
    },
    {
      id: "project",
      label: "Project",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.projectName ?? "",
      render: (item) => <span className="text-sm text-muted-foreground">{item.projectName ?? "Unassigned"}</span>,
      csvValue: (item) => item.projectName ?? "Unassigned",
      width: 220,
      editable: true,
      editValue: (item) => item.projectName ?? "",
      renderEditor: ({ item, onChange, onCancel }) => <ProjectSelectEditor item={item} allProjects={allProjects} onChange={onChange} onCancel={onCancel} onProjectEdit={handleProjectEdit} />,
    },
    {
      id: "sourceAt",
      label: "Date",
      defaultVisible: true,
      sortable: true,
      sortValue: (item) => item.sourceAt ?? "",
      render: (item) => <CellDate value={item.sourceAt} />,
      csvValue: (item) => item.sourceAt ?? "",
      width: 160,
    },
    {
      id: "original",
      label: "Original",
      defaultVisible: true,
      render: (item) => <a href={`/document-metadata?recordId=${encodeURIComponent(item.id)}`} className="text-sm text-primary hover:underline">Open in Document Metadata</a>,
      csvValue: () => "Document Metadata",
      width: 140,
    },
  ], [allProjects, handleProjectEdit]);

  const tabs = SOURCE_TABS.map((tab) => ({
    label: `${tab.label} (${tab.id === "all" ? sources.length : sources.filter((source) => source.lane === tab.id).length})`,
    href: `${pathname}${tab.id === "all" ? "" : `?lane=${tab.id}`}`,
    isActive: selectedTab === tab.id,
  }));

  return <UnifiedTablePage
    header={{ title: "Sources used", hidden: true }}
    tabs={tabs}
    toolbar={{
      totalItems: selectedTab === "all" ? sources.length : sources.filter((source) => source.lane === selectedTab).length,
      filteredItems: filteredSources.length,
      searchValue: tableState.searchInput,
      onSearchChange: tableState.setSearchInput,
      searchPlaceholder: "Search sources, projects, or content...",
      currentView: "table",
      onViewChange: () => undefined,
      enabledViews: ["table"],
      visibleColumns: tableState.visibleColumns,
      onColumnVisibilityChange: tableState.setVisibleColumns,
      columns: columns.map((column) => ({ id: column.id, label: column.label, defaultVisible: column.defaultVisible, alwaysVisible: column.alwaysVisible })),
    }}
    data={{ items: filteredSources, isLoading: false }}
    sorting={{ sortBy: tableState.sortBy, sortDirection: tableState.sortDirection, onSortChange: (sortBy, direction) => { tableState.setSortBy(sortBy); tableState.setSortDirection(direction); } }}
      table={{ columns, getRowId: (item) => item.id, stickyHeader: true, density: "compact" }}
    emptyState={{ title: "No sources for this brief", description: "This packet did not include source records in this lane.", filteredDescription: "No sources match the current search.", isFiltered: Boolean(tableState.debouncedSearch) }}
    layout={{ fullBleedTable: false }}
    features={{ enableViews: false, enableRowSelection: false, enableRowActions: false, enableInlineEditing: true }}
  />;
}

function DailyBriefMeetingsTable({ sources, tabs }: { sources: DailyBriefSourceContent[]; tabs: Array<{ label: string; href: string; isActive?: boolean }> }) {
  return <MeetingsTablePage initialMeetings={sources.map(toMeeting)} tabs={tabs} />;
}

type CardRow = DailyBriefFanoutReadback["insightCards"][number];
type TaskRow = DailyBriefFanoutReadback["tasks"][number];

function CardTable({ cardType, cards }: { cardType: string; cards: CardRow[] }) {
  const columns = React.useMemo<TableColumn<CardRow>[]>(() => [
    { id: "title", label: "Card", alwaysVisible: true, sortable: true, sortValue: (item) => item.title, render: (item) => <span className="block font-medium text-foreground" title={item.summary}>{item.title}</span>, csvValue: (item) => `${item.title}: ${item.summary}`, width: 420 },
    { id: "status", label: "Status", defaultVisible: true, sortable: true, sortValue: (item) => item.current_status, render: (item) => <CellStatus value={item.current_status} />, csvValue: (item) => item.current_status, width: 130 },
    { id: "confidence", label: "Confidence", defaultVisible: true, sortable: true, sortValue: (item) => item.confidence, render: (item) => <span className="text-sm capitalize text-muted-foreground">{item.confidence}</span>, csvValue: (item) => item.confidence, width: 130 },
    { id: "attribution", label: "Review", defaultVisible: true, sortable: true, sortValue: (item) => item.attribution_status, render: (item) => <span className="text-sm text-muted-foreground">{item.attribution_status.replaceAll("_", " ")}</span>, csvValue: (item) => item.attribution_status, width: 160 },
  ], []);

  return <UnifiedTablePage
    header={{ title: cardType.replaceAll("_", " "), hidden: true }}
    toolbar={{ totalItems: cards.length, filteredItems: cards.length, searchValue: "", onSearchChange: () => undefined, currentView: "table", onViewChange: () => undefined, enabledViews: ["table"] }}
    data={{ items: cards, isLoading: false }}
    table={{ columns, getRowId: (item) => item.id, stickyHeader: true, density: "compact" }}
    emptyState={{ title: `No ${cardType.replaceAll("_", " ")} cards`, description: "No cards of this type were promoted for this brief.", filteredDescription: "No cards of this type were promoted for this brief.", isFiltered: false }}
    layout={{ fullBleedTable: false }}
    features={{ enableViews: false, enableRowSelection: false, enableRowActions: false, enableSearch: false, enableColumnToggle: false }}
  />;
}

function TasksTable({ tasks }: { tasks: TaskRow[] }) {
  const columns = React.useMemo<TableColumn<TaskRow>[]>(() => [
    { id: "title", label: "Task", alwaysVisible: true, sortable: true, sortValue: (item) => item.title ?? "", render: (item) => <span className="font-medium text-foreground">{item.title}</span>, csvValue: (item) => item.title ?? "", width: 420 },
    { id: "status", label: "Status", defaultVisible: true, sortable: true, sortValue: (item) => item.status ?? "", render: (item) => <CellStatus value={item.status ?? "unknown"} />, csvValue: (item) => item.status ?? "unknown", width: 130 },
    { id: "due", label: "Due", defaultVisible: true, sortable: true, sortValue: (item) => item.due_date ?? "", render: (item) => <CellDate value={item.due_date} />, csvValue: (item) => item.due_date ?? "", width: 150 },
  ], []);

  return <UnifiedTablePage
    header={{ title: "Tasks", hidden: true }}
    toolbar={{ totalItems: tasks.length, filteredItems: tasks.length, searchValue: "", onSearchChange: () => undefined, currentView: "table", onViewChange: () => undefined, enabledViews: ["table"] }}
    data={{ items: tasks, isLoading: false }}
    table={{ columns, getRowId: (item) => item.id, stickyHeader: true, density: "compact" }}
    emptyState={{ title: "No tasks", description: "No tasks were generated from this brief.", filteredDescription: "No tasks were generated from this brief.", isFiltered: false }}
    layout={{ fullBleedTable: false }}
    features={{ enableViews: false, enableRowSelection: false, enableRowActions: false, enableSearch: false, enableColumnToggle: false }}
  />;
}

export function DailyBriefFanoutReview({ run }: { run: DailyBriefFanoutReadback }) {
  const groupedCards = Object.entries(Object.groupBy(run.insightCards, (card) => card.card_type));
  const searchParams = useSearchParams();
  const pathname = usePathname() ?? "";
  const activeLane = searchParams.get("lane") ?? "meetings";
  const sourceTabs = SOURCE_TABS.map((tab) => ({
    label: `${tab.label} (${tab.id === "all" ? run.sources.length : run.sources.filter((source) => source.lane === tab.id).length})`,
    href: `${pathname}${tab.id === "all" ? "" : `?lane=${tab.id}`}`,
    isActive: activeLane === tab.id,
  }));
  const meetingSources = run.sources.filter((source) => source.lane === "meetings");

  return <div className="space-y-10">
    <section className="space-y-4">
      {activeLane === "meetings" ? <DailyBriefMeetingsTable sources={meetingSources} tabs={sourceTabs} /> : <>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-foreground">Sources used</h2><p className="text-sm text-muted-foreground">Records included in this brief, limited to {run.packet.businessDate}.</p></div>
          {run.sourceReadError ? <p className="text-sm text-danger">{run.sourceReadError}</p> : null}
        </div>
        <SourceTable sources={run.sources} allProjects={run.allProjects} />
      </>}
    </section>
    <section className="space-y-4">
      <div><h2 className="text-lg font-semibold text-foreground">Insight cards</h2><p className="text-sm text-muted-foreground">Grouped by card type so review starts with the kind of signal, not an undifferentiated list.</p></div>
      {run.candidateReadError ? <p className="text-sm text-danger">{run.candidateReadError}</p> : null}
      {groupedCards.length ? <div className="space-y-8">{groupedCards.map(([type, cards]) => { const cardRows = cards ?? []; return <section key={type} className="space-y-3"><h3 className="text-sm font-semibold capitalize text-foreground">{type.replaceAll("_", " ")} <span className="font-normal text-muted-foreground">({cardRows.length})</span></h3><CardTable cardType={type} cards={cardRows} /></section>; })}</div> : <p className="text-sm text-danger">No promoted insight cards are linked to this packet.</p>}
    </section>
    <section className="space-y-4">
      <div><h2 className="text-lg font-semibold text-foreground">Tasks</h2><p className="text-sm text-muted-foreground">Tasks generated from this brief, with status and due date in one table.</p></div>
      <TasksTable tasks={run.tasks} />
    </section>
  </div>;
}
