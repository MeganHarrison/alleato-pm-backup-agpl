"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  ChevronDown,
  Dot,
  FileText,
  Flag,
  LayoutDashboard,
  List,
  PlayCircle,
  RefreshCcw,
} from "lucide-react";

import { Badge, Button, ErrorState, StatusBadge } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout";
import {
  DetailPropertyBar,
  DetailPropertyItem,
} from "@/components/ui/detail-property-bar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SplitPage, SplitPageFrame, useSplitPage } from "@/components/ui/split-page";
import type { ControlPlaneData } from "@/lib/codex-command-center/control-plane";
import { cn } from "@/lib/utils";

type OpsData = ControlPlaneData | undefined;
type WorkItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  nextAction: string;
  objective: string | null;
  linearIssue: string;
  ownedPaths: string[];
  risks: string[];
  taskPath: string | null;
  handoffPath: string | null;
  updatedAt: string | null;
  evidence?: string | null;
  notes?: string | null;
};

export function OpsPanel({
  title,
  description,
  isLoading,
  error,
  data,
  children,
}: {
  title?: string;
  description?: string;
  isLoading: boolean;
  error: unknown;
  data: OpsData;
  children: React.ReactNode;
}) {
  const errorMessage =
    error instanceof Error ? error.message : "Control-plane data could not load.";

  return (
    <div className="space-y-6 pt-2">
      {title || description ? (
        <section className="space-y-2">
          {title ? <SectionRuleHeading label={title} className="mb-0 pb-0" /> : null}
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </section>
      ) : null}

      {isLoading ? (
        <div className="py-12 text-sm text-muted-foreground">
          Loading control-plane data...
        </div>
      ) : error ? (
        <ErrorState
          title="Control-plane data could not load"
          error={`${errorMessage} Prevention: restore docs/ops/orchestration and verify the admin API can read the repo ledger files.`}
          className="items-start py-2 text-left"
        />
      ) : (
        <>
          {data?.issues?.length ? <ControlPlaneIssues issues={data.issues} /> : null}
          {children}
        </>
      )}
    </div>
  );
}

export function ActiveWorkWorkspace({
  sessions,
  resumePacks,
  reviewQueue,
}: {
  sessions: ControlPlaneData["sessions"];
  resumePacks: ControlPlaneData["resumePacks"];
  reviewQueue: ControlPlaneData["reviewQueue"];
}) {
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  const activeItems = useMemo<WorkItem[]>(
    () =>
      resumePacks.map((pack) => {
        const session = sessions.find((row) => row.session === pack.session);
        return {
          id: pack.session,
          title: pack.initiative,
          subtitle: pack.taskTitle ?? session?.scope ?? "Active workstream",
          status: pack.currentStatus,
          nextAction: pack.handoffNextAction ?? pack.nextCheckpoint,
          objective: pack.taskObjective,
          linearIssue: pack.linearIssue,
          ownedPaths: pack.ownedPaths,
          risks: pack.risks,
          taskPath: pack.taskPath,
          handoffPath: pack.handoffPath,
          updatedAt: session?.lastUpdate ?? null,
          notes: session?.scope ?? null,
        };
      }),
    [resumePacks, sessions],
  );

  const reviewItems = useMemo<WorkItem[]>(
    () =>
      reviewQueue.map((item) => ({
        id: item.reviewId,
        title: item.initiative,
        subtitle: `${item.session} review item`,
        status: item.status,
        nextAction: item.dispositionNotes,
        objective:
          "Review the evidence, accept or reject the handoff, and decide the next owner action.",
        linearIssue: item.linearIssue,
        ownedPaths: item.evidence ? [item.evidence] : [],
        risks: item.dispositionNotes ? [item.dispositionNotes] : [],
        taskPath: null,
        handoffPath: item.evidence || null,
        updatedAt: item.lastUpdate,
        evidence: item.evidence,
        notes: `Reviewer: ${item.reviewer}`,
      })),
    [reviewQueue],
  );

  const visibleItems = viewMode === "board" ? [...activeItems, ...reviewItems] : activeItems;

  return (
    <WorkspaceSurface
      emptyMessage="No active workstreams are recorded."
      items={visibleItems}
      listTitle="Active workstreams"
      firstPaneClassName={viewMode === "board" ? "xl:w-[42rem]" : "xl:w-[24rem]"}
      renderPane={({ selectedId, onSelect, title }) => (
        <ActiveWorkPane
          title={title}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeItems={activeItems}
          reviewItems={reviewItems}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
      renderDetail={(item) => (
        <WorkItemDetail
          item={item}
          emptyMessage="Select a workstream to see what it is and what to do next."
        />
      )}
    />
  );
}

export function ReviewWorkspace({
  reviewQueue,
}: {
  reviewQueue: ControlPlaneData["reviewQueue"];
}) {
  const items = useMemo<WorkItem[]>(
    () =>
      reviewQueue.map((item) => ({
        id: item.reviewId,
        title: item.initiative,
        subtitle: `${item.session} review item`,
        status: item.status,
        nextAction: item.dispositionNotes,
        objective: "Review the evidence, accept or reject the handoff, and decide the next owner action.",
        linearIssue: item.linearIssue,
        ownedPaths: item.evidence ? [item.evidence] : [],
        risks: item.dispositionNotes ? [item.dispositionNotes] : [],
        taskPath: null,
        handoffPath: item.evidence || null,
        updatedAt: item.lastUpdate,
        evidence: item.evidence,
        notes: `Reviewer: ${item.reviewer}`,
      })),
    [reviewQueue],
  );

  return (
    <WorkspaceSurface
      emptyMessage="No review items are queued."
      items={items}
      listTitle="Pending review"
      renderDetail={(item) => (
        <WorkItemDetail
          item={item}
          emptyMessage="Select a review item to inspect the evidence and next action."
        />
      )}
    />
  );
}

function WorkspaceSurface({
  items,
  listTitle,
  emptyMessage,
  renderDetail,
  renderPane,
  firstPaneClassName,
}: {
  items: WorkItem[];
  listTitle: string;
  emptyMessage: string;
  renderDetail: (item: WorkItem | null) => React.ReactNode;
  renderPane?: (args: {
    selectedId: string | null;
    onSelect: (id: string) => void;
    title: string;
  }) => React.ReactNode;
  firstPaneClassName?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && items.some((item) => item.id === current) ? current : items[0].id,
    );
  }, [items]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  if (!items.length) {
    return <div className="py-8 text-sm text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <SplitPageFrame
      height="fill"
      className="relative flex h-full min-h-0 w-full flex-1 overflow-hidden rounded-md border border-border"
    >
      <SplitPage
        variant="two-column"
        breakpoint="xl"
        defaultIsOpen
        className="min-h-0 flex-1"
        firstPaneClassName={cn(
          "w-full xl:w-[24rem] border-r border-border/60 bg-background",
          firstPaneClassName,
        )}
        secondPaneClassName="bg-background"
      >
        {renderPane ? (
          renderPane({ selectedId, onSelect: setSelectedId, title: listTitle })
        ) : (
          <WorkspaceListPane
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            title={listTitle}
          />
        )}
        <WorkspaceDetailPane>{renderDetail(selectedItem)}</WorkspaceDetailPane>
      </SplitPage>
    </SplitPageFrame>
  );
}

function ActiveWorkPane({
  title,
  viewMode,
  onViewModeChange,
  activeItems,
  reviewItems,
  selectedId,
  onSelect,
}: {
  title: string;
  viewMode: "list" | "board";
  onViewModeChange: (value: "list" | "board") => void;
  activeItems: WorkItem[];
  reviewItems: WorkItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const splitPage = useSplitPage();

  function handleSelect(id: string) {
    onSelect(id);
    if (!splitPage.isDesktop) splitPage.onClose();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-4">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value === "list" || value === "board") onViewModeChange(value);
          }}
          aria-label="Active work view"
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="Board view">
            <LayoutDashboard className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {viewMode === "board" ? (
        <ActiveWorkBoardPane
          activeItems={activeItems}
          reviewItems={reviewItems}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      ) : (
        <WorkspaceListPane
          items={activeItems}
          selectedId={selectedId}
          onSelect={handleSelect}
          title=""
          hideHeader
        />
      )}
    </div>
  );
}

function ActiveWorkBoardPane({
  activeItems,
  reviewItems,
  selectedId,
  onSelect,
}: {
  activeItems: WorkItem[];
  reviewItems: WorkItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
      <div className="grid min-h-full gap-4 xl:grid-cols-2">
        <BoardColumn
          title="Active Work"
          items={activeItems}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyLabel="No active work"
          toneClassName="bg-amber-50/35"
        />
        <BoardColumn
          title="Needs Review"
          items={reviewItems}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyLabel="Nothing waiting for review"
          toneClassName="bg-sky-50/35"
        />
      </div>
    </div>
  );
}

function BoardColumn({
  title,
  items,
  selectedId,
  onSelect,
  emptyLabel,
  toneClassName,
}: {
  title: string;
  items: WorkItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyLabel: string;
  toneClassName: string;
}) {
  return (
    <section className={cn("flex min-h-0 flex-col rounded-md p-3", toneClassName)}>
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              isSelected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md bg-background/80 px-3 py-4 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}

function BoardCard({
  item,
  isSelected,
  onSelect,
}: {
  item: WorkItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => onSelect(item.id)}
      className={cn(
        "h-auto w-full justify-start whitespace-normal rounded-xl border border-border bg-background px-4 py-3 text-left shadow-none hover:bg-background",
        isSelected && "border-foreground/20 ring-1 ring-foreground/10",
      )}
    >
      <div className="flex min-w-0 flex-col items-start gap-2">
        <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.linearIssue ? <span>{item.linearIssue}</span> : null}
          {item.linearIssue ? <Dot className="-mx-1 h-4 w-4 shrink-0" /> : null}
          <span>{item.status}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.nextAction}</p>
      </div>
    </Button>
  );
}

function WorkspaceListPane({
  items,
  selectedId,
  onSelect,
  title,
  hideHeader = false,
}: {
  items: WorkItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title: string;
  hideHeader?: boolean;
}) {
  const splitPage = useSplitPage();

  function handleSelect(id: string) {
    onSelect(id);
    if (!splitPage.isDesktop) splitPage.onClose();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {hideHeader ? null : (
        <div className="border-b border-border/60 px-4 py-4">
          <div className="text-sm font-semibold text-foreground">{title}</div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-border/60">
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            const statusToneClass = getStatusToneClass(item.status);
            return (
              <Button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start whitespace-normal rounded-none border-t-2 border-transparent px-4 py-3 text-left transition-colors hover:bg-muted/30",
                  statusToneClass,
                  isSelected && "bg-muted/40",
                )}
              >
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                  <div className="truncate text-sm font-medium text-foreground">
                    {item.title}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <Dot className="-mx-1 h-4 w-4 shrink-0" />
                    <span>{item.status}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {item.nextAction}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getStatusToneClass(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus.includes("progress")) return "border-t-amber-500";
  if (normalizedStatus.includes("review")) return "border-t-blue-500";
  if (normalizedStatus.includes("blocked")) return "border-t-rose-500";
  if (normalizedStatus.includes("done") || normalizedStatus.includes("complete")) {
    return "border-t-emerald-500";
  }

  return "border-t-border";
}

function getLinearIssueHref(linearIssue: string): string {
  return `https://linear.app/megankharrison/issue/${linearIssue}`;
}

function getCommandCenterFileHref(filePath: string): string {
  return `/command-center/file?path=${encodeURIComponent(filePath)}`;
}

function WorkspaceDetailPane({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-0 overflow-y-auto bg-background">{children}</div>;
}

function WorkItemDetail({
  item,
  emptyMessage,
}: {
  item: WorkItem | null;
  emptyMessage: string;
}) {
  const splitPage = useSplitPage();

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {item.linearIssue ? (
                <Link
                  href={getLinearIssueHref(item.linearIssue)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {item.linearIssue}
                </Link>
              ) : null}
              <StatusBadge status={item.status} />
            </div>
            {!splitPage.isDesktop ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-mr-2 px-2 text-muted-foreground"
                onClick={splitPage.onOpen}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to list
              </Button>
            ) : null}
          </div>
          <div className="text-lg font-semibold text-foreground">{item.title}</div>
          <p className="text-sm text-muted-foreground">
            {item.objective ?? item.subtitle}
          </p>
          <DetailPropertyBar className="mb-0 mt-3 flex-col items-start gap-3 pb-0">
            <DetailPropertyItem icon={PlayCircle}>
              {item.nextAction}
            </DetailPropertyItem>
            {item.updatedAt ? (
              <DetailPropertyItem icon={RefreshCcw}>
                Updated {item.updatedAt}
              </DetailPropertyItem>
            ) : null}
            {item.taskPath ? (
              <DetailPropertyItem icon={FileText} href={getCommandCenterFileHref(item.taskPath)}>
                {item.taskPath}
              </DetailPropertyItem>
            ) : null}
            {item.handoffPath ? (
              <DetailPropertyItem
                icon={ClipboardList}
                href={getCommandCenterFileHref(item.handoffPath)}
              >
                {item.handoffPath}
              </DetailPropertyItem>
            ) : null}
          </DetailPropertyBar>
        </div>
      </div>

      <div className="space-y-8 px-5 py-5">
        <section className="space-y-3">
          <SectionRuleHeading label="Next useful action" className="mb-0 pb-0" />
          <p className="text-sm text-foreground">{item.nextAction}</p>
        </section>

        {item.notes ? (
          <section className="space-y-2">
            <SectionRuleHeading label="Current context" className="mb-0 pb-0" />
            <p className="text-sm text-muted-foreground">{item.notes}</p>
          </section>
        ) : null}

        {item.ownedPaths.length > 0 ? (
          <section className="space-y-3">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-left">
                <SectionRuleHeading
                  label={`Owned paths (${item.ownedPaths.length})`}
                  className="mb-0 pb-0"
                />
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-3 space-y-2">
                {item.ownedPaths.map((ownedPath) => (
                  <Link
                    key={ownedPath}
                    href={getCommandCenterFileHref(ownedPath)}
                    className="block font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {ownedPath}
                  </Link>
                ))}
              </div>
            </details>
          </section>
        ) : null}

        {item.risks.length > 0 ? (
          <section className="space-y-3">
            <SectionRuleHeading label="Risks and blockers" className="mb-0 pb-0" />
            <div className="space-y-2">
              {item.risks.map((risk) => (
                <div key={risk} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Flag className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{risk}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

      </div>
    </div>
  );
}

function ControlPlaneIssues({
  issues,
}: {
  issues: ControlPlaneData["issues"];
}) {
  return (
    <section className="space-y-3">
      <SectionRuleHeading label="Control-plane warnings" className="mb-0 pb-0" />
      <div className="overflow-hidden rounded-md border border-border">
        <div className="divide-y divide-border/60">
          {issues.map((issue) => (
            <div
              key={`${issue.scope}-${issue.path}`}
              className="grid gap-1 px-4 py-3 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-4"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {issue.scope}
              </div>
              <div className="space-y-1">
                <div className="font-mono text-xs text-foreground">
                  {issue.path}
                </div>
                <p className="text-sm text-muted-foreground">{issue.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
