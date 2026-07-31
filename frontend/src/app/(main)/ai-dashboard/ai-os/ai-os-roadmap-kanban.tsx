"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners,
  useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "@/lib/utils";
import { ROADMAP_COLUMNS, type RoadmapCard } from "./ai-os-data";
import styles from "./ai-os.module.css";

interface Col { name: string; varName: string; cards: RoadmapCard[]; }

/** Column name that contains the card with this stable id. */
const colOf = (cols: Col[], cardId: string) =>
  cols.find((c) => c.cards.some((card) => card.id === cardId))?.name;

function CardBody({ card, overlay }: { card: RoadmapCard; overlay?: boolean }) {
  return (
    <div className={cn("rounded-lg bg-background/55 px-3 py-3", overlay && "shadow-sm ring-1 ring-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium leading-tight tracking-tight text-foreground">{card.name}</div>
        {card.priority === "high" ? (
          <span className={cn(styles.kprio, styles.kprioHigh, "flex-none")}>high</span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">{card.owner} · {card.needs}</span>
        <span className="font-mono tabular-nums">{card.progress}%</span>
      </div>
      <div className={styles.kbar}><span className={styles.kbarFill} style={{ width: `${card.progress}%` }} /></div>
    </div>
  );
}

function SortableCard({ card }: { card: RoadmapCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-none rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <CardBody card={card} />
    </div>
  );
}

function Column({ col }: { col: Col }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.name}` });
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className={styles.kdot} style={{ background: `var(${col.varName})` }} />
        {col.name}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground/70">{col.cards.length}</span>
      </div>
      <SortableContext items={col.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-[80px] flex-col gap-2.5 rounded-lg p-1 transition-colors",
            isOver && "bg-muted/40",
          )}
        >
          {col.cards.map((c) => <SortableCard key={c.id} card={c} />)}
        </div>
      </SortableContext>
    </div>
  );
}

export function RoadmapKanban() {
  const [cols, setCols] = useState<Col[]>(() =>
    ROADMAP_COLUMNS.map((c) => ({ name: c.name, varName: c.varName, cards: [...c.cards] })),
  );
  const [activeCard, setActiveCard] = useState<RoadmapCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    const card = cols.flatMap((c) => c.cards).find((c) => c.id === id) ?? null;
    setActiveCard(card);
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setCols((prev) => {
      const fromCol = colOf(prev, activeId);
      const toCol = overId.startsWith("col:") ? overId.slice(4) : colOf(prev, overId);
      if (!fromCol || !toCol || fromCol === toCol) return prev;
      const moving = prev.find((c) => c.name === fromCol)?.cards.find((c) => c.id === activeId);
      if (!moving) return prev;
      return prev.map((c) => {
        if (c.name === fromCol) return { ...c, cards: c.cards.filter((x) => x.id !== activeId) };
        if (c.name === toCol) {
          const idx = overId.startsWith("col:") ? c.cards.length : c.cards.findIndex((x) => x.id === overId);
          const next = [...c.cards];
          next.splice(idx < 0 ? next.length : idx, 0, moving);
          return { ...c, cards: next };
        }
        return c;
      });
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveCard(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setCols((prev) => {
      const col = colOf(prev, activeId);
      const overCol = overId.startsWith("col:") ? overId.slice(4) : colOf(prev, overId);
      if (!col || !overCol || col !== overCol) return prev;
      const target = prev.find((c) => c.name === col);
      if (!target) return prev;
      const oldIndex = target.cards.findIndex((c) => c.id === activeId);
      const newIndex = overId.startsWith("col:")
        ? target.cards.length - 1
        : target.cards.findIndex((c) => c.id === overId);
      if (newIndex < 0 || oldIndex === newIndex) return prev;
      return prev.map((c) => (c.name === col ? { ...c, cards: arrayMove(c.cards, oldIndex, newIndex) } : c));
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {cols.map((col) => <Column key={col.name} col={col} />)}
      </div>
      <DragOverlay>{activeCard ? <CardBody card={activeCard} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
