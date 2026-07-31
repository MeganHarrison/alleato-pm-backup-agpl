"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageShell } from "@/components/layout";
import { Download, FileUp, GripVertical, Layers } from "lucide-react";
import { useDrawings } from "@/hooks/use-drawings";
import type { DrawingLogTableRow } from "@/types/drawings.types";

type DrawingStatus = "approved" | "under_review" | "superseded";

interface BoardItem extends DrawingLogTableRow {
  boardStatus: DrawingStatus;
}

interface BoardColumn {
  id: string;
  title: string;
  description: string;
  accent: string;
  items: BoardItem[];
}

const columnOrder = ["approved", "under_review", "superseded"];

const columnConfig: Record<string, Omit<BoardColumn, "items">> = {
  approved: {
    id: "approved",
    title: "Approved",
    description: "Field-ready revisions that crews can rely on.",
    accent: "bg-success/5 border-success/20",
  },
  under_review: {
    id: "under_review",
    title: "Under Review",
    description: "Pending approvals before team-wide release.",
    accent: "bg-warning/5 border-warning/20",
  },
  superseded: {
    id: "superseded",
    title: "Superseded",
    description: "Revisions archived after newer releases.",
    accent: "bg-muted/30 border-border",
  },
};

export default function DrawingsBoardPage() {
  const params = useParams()!;
  const projectId = params.projectId as string;

  const { data: drawingsResponse, isLoading } = useDrawings(projectId);
  const drawings = drawingsResponse?.drawings || [];

  const [columns, setColumns] = useState<Record<string, BoardColumn>>(() => {
    const initialColumns: Record<string, BoardColumn> = {};
    columnOrder.forEach((colId) => {
      initialColumns[colId] = { ...columnConfig[colId], items: [] };
    });
    return initialColumns;
  });

  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  React.useEffect(() => {
    if (!drawings) return;

    const newColumns: Record<string, BoardColumn> = {};
    columnOrder.forEach((colId) => {
      newColumns[colId] = { ...columnConfig[colId], items: [] };
    });

    drawings.forEach((drawing) => {
      const status = drawing.status as DrawingStatus;
      if (newColumns[status]) {
        newColumns[status].items.push({ ...drawing, boardStatus: status });
      }
    });

    setColumns(newColumns);
  }, [drawings]);

  const totalDrawings = useMemo(
    () => Object.values(columns).reduce((count, column) => count + column.items.length, 0),
    [columns],
  );


  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return (
      Object.values(columns)
        .flatMap((column) => column.items)
        .find((item) => item.id === activeId) ?? null
    );
  }, [activeId, columns]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor),
  );

  const findColumnId = (itemId: UniqueIdentifier | null): string | null => {
    if (!itemId) return null;
    const entry = Object.entries(columns).find(([, column]) =>
      column.items.some((item) => item.id === itemId),
    );
    return entry?.[0] ?? null;
  };

  const handleDragStart = ({ active }: { active: { id: UniqueIdentifier } }) => {
    setActiveId(active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const sourceColumnId = findColumnId(active.id);
    const destinationColumnId = findColumnId(over.id);
    if (!sourceColumnId || !destinationColumnId) return;

    setColumns((prev) => {
      const source = prev[sourceColumnId];
      const destination = prev[destinationColumnId];
      const activeIndex = source.items.findIndex((item) => item.id === active.id);
      const overIndex = destination.items.findIndex((item) => item.id === over.id);

      if (sourceColumnId === destinationColumnId) {
        if (activeIndex === -1 || overIndex === -1) return prev;
        const updated = arrayMove(source.items, activeIndex, overIndex);
        return {
          ...prev,
          [sourceColumnId]: { ...source, items: updated },
        };
      }

      const movingItem = source.items[activeIndex];
      if (!movingItem) return prev;

      const updatedSource = source.items.filter((item) => item.id !== active.id);
      const updatedDestination = [...destination.items];
      const insertIndex = overIndex === -1 ? updatedDestination.length : overIndex;
      updatedDestination.splice(insertIndex, 0, { ...movingItem, boardStatus: destinationColumnId as DrawingStatus });

      return {
        ...prev,
        [sourceColumnId]: { ...source, items: updatedSource },
        [destinationColumnId]: {
          ...destination,
          items: updatedDestination,
        },
      };
    });
  };

  return (
    <PageShell
      variant="dashboard"
      title="Drawings Board"
      description="Drag-and-drop drawing packages by status"
      actions={
        <Button size="sm" className="gap-2">
          <FileUp />
          Upload revisions
        </Button>
      }
    >
        <div className="space-y-6">
          <Card className="border-dashed border-2 border-border bg-card">
            <CardHeader className="flex flex-wrap items-center gap-4 justify-between pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <CardTitle className="text-base">Status board</CardTitle>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Download />
                Export board
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto pb-4 pt-2">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-muted-foreground">Loading drawings...</div>
                </div>
              ) : (
                <DndContext
                  collisionDetection={closestCenter}
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex gap-4 min-w-[700px]">
                    {columnOrder.map((columnId) => {
                      const column = columns[columnId];
                      if (!column) return null;

                      return (
                        <div
                          key={column.id}
                          className={`min-w-[280px] w-[320px] rounded-2xl border p-4 ${column.accent}`}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold">{column.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {column.description}
                              </p>
                            </div>
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-background text-sm font-semibold text-foreground">
                              {column.items.length}
                            </span>
                          </div>
                          <SortableContext
                            items={column.items.map((item) => item.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-4">
                              {column.items.map((item) => (
                                <BoardCard key={item.id} item={item} columnId={column.id} />
                              ))}
                              {column.items.length === 0 ? (
                                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                                  Drop drawings here
                                </div>
                              ) : null}
                            </div>
                          </SortableContext>
                        </div>
                      );
                    })}
                  </div>
                  <DragOverlay>
                    {activeItem ? (
                      <div className="w-[320px]">
                        <BoardCardPreview item={activeItem} />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </div>
    </PageShell>
  );
}

interface BoardCardProps {
  item: BoardItem;
  columnId: string;
}

function BoardCard({ item, columnId }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      data: {
        columnId,
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border bg-background p-4 shadow-sm transition ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="flex items-start gap-4">
        <Button
          {...attributes}
          {...listeners}
          variant="outline"
          size="icon"
          className="text-muted-foreground hover:bg-muted/40"
          aria-label="Drag card"
        >
          <GripVertical />
        </Button>
        <BoardCardPreview item={item} />
      </div>
    </div>
  );
}

function BoardCardPreview({ item }: { item: BoardItem }) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {item.setName || "No Set"}
        </span>
        <span className="text-xs text-muted-foreground">{item.revisionNumber}</span>
      </div>
      <div className="text-lg font-semibold text-foreground">{item.drawingNumber}</div>
      <p className="text-sm text-muted-foreground">{item.title}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Badge variant="outline" className="px-2 py-1 text-[11px]">
          {item.discipline}
        </Badge>
        <span>{item.fileSize ? `${Math.round(item.fileSize / 1024)} KB` : "N/A"}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{item.uploadedByEmail || "Unknown"}</span>
        <span>{item.receivedDate ? new Date(item.receivedDate).toLocaleDateString() : "N/A"}</span>
      </div>
    </div>
  );
}
