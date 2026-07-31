"use client";

import { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { EmptyState } from "@/components/ds";
import { ErrorState } from "@/components/ds/error-state";
import { Button } from "@/components/ui/button";
import { Lightbulb, LayoutGrid, Table2 } from "lucide-react";
import { PageShell } from "@/components/layout";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { useUnifiedTableState } from "@/components/tables/unified";
import { cn } from "@/lib/utils";
import { BOARD_STATUSES, BOARD_STATUS_LABELS, type BoardStatus } from "@/lib/admin-feedback/constants";
import { useProductBoard, type BoardItem } from "./use-product-board";
import { BoardColumn } from "./board-column";
import { BoardCardOverlay } from "./board-card";
import { BoardFilterBar, type BoardFilters } from "./board-filter-bar";
import { loadCardViewSettings, saveCardViewSettings, type CardViewSettings } from "./card-view-settings";
import { BoardUnifiedTable } from "./board-unified-table";
import { matchesBoardCaptureTopics } from "./topics";
import {
  matchesBoardItemType,
  matchesBoardTextMetadata,
} from "./metadata";

interface ProductBoardClientProps {
  readonly?: boolean;
}

function filterItems(items: BoardItem[], filters: BoardFilters): BoardItem[] {
  return items.filter((item) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!item.title.toLowerCase().includes(q) && !item.comment?.toLowerCase().includes(q)) return false;
    }
    if (!matchesBoardCaptureTopics(item, filters.topics)) return false;
    if (filters.assigneeId && item.assignee_id !== filters.assigneeId) return false;
    if (filters.priority && item.severity !== filters.priority) return false;
    if (filters.labelColor) {
      const meta = (item.metadata as { labels?: { color: string }[] } | null) ?? {};
      if (!meta.labels?.some((l) => l.color === filters.labelColor)) return false;
    }
    if (!matchesBoardTextMetadata(item, "tool", filters.tool)) return false;
    if (!matchesBoardTextMetadata(item, "category", filters.category)) return false;
    if (!matchesBoardItemType(item, filters.type)) return false;
    return true;
  });
}

type ViewMode = "board" | "table";

function hasActiveBoardFilters(filters: BoardFilters): boolean {
  return Boolean(
    filters.search ||
    filters.assigneeId ||
    filters.priority ||
    filters.labelColor ||
    filters.topics?.length ||
    filters.tool ||
    filters.category ||
    filters.type,
  );
}

export function ProductBoardClient({ readonly }: ProductBoardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items, isLoading, error, activeId, setActiveId, updateStatus, reorder } = useProductBoard();
  const [filters, setFilters] = useState<BoardFilters>({});
  const [cardSettings, setCardSettings] = useState<CardViewSettings>(loadCardViewSettings);
  const viewState = useUnifiedTableState({
    entityKey: "product-board",
    searchParams,
    pathname,
    router,
      defaults: {
        view: "board",
        allowedViews: ["board", "table"],
        page: 1,
        perPage: 25,
        search: "",
        sortBy: null,
        sortDirection: "asc",
        visibleColumns: [],
        filters: {},
      },
    });
  const viewMode = viewState.currentView as ViewMode;

  function updateCardSettings(patch: Partial<CardViewSettings>) {
    setCardSettings((prev) => {
      const next = { ...prev, ...patch };
      saveCardViewSettings(next);
      return next;
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const filteredItems = useMemo(() => filterItems(items, filters), [items, filters]);
  const activeFilters = hasActiveBoardFilters(filters);
  const activeItem = items.find((i) => i.id === activeId);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const draggedItem = items.find((i) => i.id === active.id);
    if (!draggedItem) return;

    // Resolve target column — over.id is either a BoardStatus or a card id
    let targetStatus: BoardStatus;
    let overItem: BoardItem | undefined;

    if ((BOARD_STATUSES as readonly string[]).includes(over.id as string)) {
      targetStatus = over.id as BoardStatus;
    } else {
      overItem = items.find((i) => i.id === over.id);
      if (!overItem) return;
      targetStatus = overItem.board_status;
    }

    const sameColumn = draggedItem.board_status === targetStatus;
    const columnItems = items
      .filter((i) => i.board_status === targetStatus)
      .sort((a, b) => a.position - b.position);

    if (sameColumn && overItem) {
      // Within-column reorder
      const oldIndex = columnItems.findIndex((i) => i.id === active.id);
      const newIndex = columnItems.findIndex((i) => i.id === over.id);
      if (oldIndex === newIndex) return;

      const reordered = arrayMove(columnItems, oldIndex, newIndex);
      const moved = reordered[newIndex];
      const prev = reordered[newIndex - 1];
      const next = reordered[newIndex + 1];

      let newPosition: number;
      if (!prev) newPosition = (next?.position ?? 1000) / 2;
      else if (!next) newPosition = (prev.position ?? 0) + 1000;
      else newPosition = (prev.position + next.position) / 2;

      reorder(moved.id, newPosition);
    } else {
      // Cross-column move — place at bottom of target column
      const bottomPosition = columnItems.length > 0
        ? columnItems[columnItems.length - 1].position + 1000
        : 1000;
      updateStatus(draggedItem.id, targetStatus, bottomPosition);
    }
  }

  const headerActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="inline-flex shrink-0 items-center rounded-md bg-muted p-0.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            viewState.setCurrentView("board");
            viewState.setSearchParams({ view: "board" });
          }}
          className={cn(
            "h-6 gap-1.5 px-2 text-[11px] font-medium",
            viewMode === "board"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="h-3 w-3" />
          Board
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            viewState.setCurrentView("table");
            viewState.setSearchParams({ view: "table" });
          }}
          className={cn(
            "h-6 gap-1.5 px-2 text-[11px] font-medium",
            viewMode === "table"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Table2 className="h-3 w-3" />
          Table
        </Button>
      </div>
      <ExpandableSearch
        value={filters.search ?? ""}
        onChange={(v) => setFilters((f) => ({ ...f, search: v || undefined }))}
        placeholder="Search cards…"
      />
      <BoardFilterBar
        items={items}
        filters={filters}
        onChange={setFilters}
        cardSettings={cardSettings}
        onCardSettingsChange={updateCardSettings}
      />
    </div>
  );

  let body: React.ReactNode;

  if (viewMode === "table") {
    // Table view — UnifiedTablePage handles its own loading/error/empty states
    body = (
      <BoardUnifiedTable
        items={filteredItems}
        isLoading={isLoading}
        error={error instanceof Error ? error : error ? new Error("Failed to load board") : null}
        isFiltered={activeFilters}
      />
    );
  } else if (isLoading) {
    body = (
      <div className="overflow-x-auto pb-6">
        <div className="grid w-max min-w-max grid-flow-col auto-cols-[minmax(15rem,17rem)] gap-2.5">
          {BOARD_STATUSES.map((status) => (
            <div key={status} className="h-64 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      </div>
    );
  } else if (error) {
    body = <ErrorState title="Couldn't load the board" description={error.message} />;
  } else if (filteredItems.length === 0) {
    body = (
      <EmptyState
        icon={<Lightbulb />}
        title={activeFilters ? "No items match the current filters" : "No feature requests yet"}
        description={activeFilters ? "Try clearing or adjusting the tool, category, or type filters." : "Submit ideas via the feedback button — they'll appear here automatically."}
      />
    );
  } else {
    body = (
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-6">
          <div className="grid w-max min-w-max grid-flow-col auto-cols-[minmax(15rem,17rem)] gap-2.5">
            {BOARD_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                label={BOARD_STATUS_LABELS[status]}
                items={filteredItems
                  .filter((i) => i.board_status === status)
                  .sort((a, b) => a.position - b.position)}
                allItems={items
                  .filter((i) => i.board_status === status)
                  .sort((a, b) => a.position - b.position)}
                readonly={readonly}
                cardSettings={cardSettings}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
          {activeItem ? <BoardCardOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>
    );
  }

  return (
    <PageShell
      variant="dashboard"
      title="Roadmap"
      actions={headerActions}
      contentClassName="space-y-4 pt-2"
      containerPaddingClassName="px-4 sm:pl-6 sm:pr-0 lg:pl-8 lg:pr-0 pt-2 pb-4"
    >
      <div className="min-w-0">{body}</div>
    </PageShell>
  );
}
