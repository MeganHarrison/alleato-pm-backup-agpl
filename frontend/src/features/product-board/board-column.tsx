"use client";

import { useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BoardCard } from "./board-card";
import { useCreateBoardItem } from "./use-board-item";
import type { BoardItem } from "./use-product-board";
import type { BoardStatus } from "@/lib/admin-feedback/constants";
import type { CardViewSettings } from "./card-view-settings";
import { DEFAULT_CARD_VIEW_SETTINGS } from "./card-view-settings";

const COLUMN_BG: Record<BoardStatus, string> = {
  submitted: "bg-muted/40",
  planned: "bg-muted/40",
  in_progress: "bg-muted/40",
  leadership_review: "bg-muted/40",
  shipped: "bg-muted/40",
};

const COUNT_PILL: Record<BoardStatus, string> = {
  submitted: "bg-background text-muted-foreground ring-1 ring-inset ring-border",
  planned: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  leadership_review: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  shipped: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const STAGE_DOT: Record<BoardStatus, string> = {
  submitted: "bg-muted-foreground/40",
  planned: "bg-violet-500 dark:bg-violet-400",
  in_progress: "bg-amber-500 dark:bg-amber-400",
  leadership_review: "bg-blue-500 dark:bg-blue-400",
  shipped: "bg-emerald-500 dark:bg-emerald-400",
};

// ── Inline card creator ───────────────────────────────────────────────────────

function InlineCardCreator({ status, onDone }: { status: BoardStatus; onDone?: () => void }) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const create = useCreateBoardItem();

  function open() {
    setAdding(true);
    // Let React render the textarea before focusing
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function close() {
    setTitle("");
    setAdding(false);
    onDone?.();
  }

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed) { close(); return; }
    create.mutate({ title: trimmed, board_status: status });
    setTitle(""); // stay open for next card (Trello behaviour)
    textareaRef.current?.focus();
  }

  if (!adding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={open}
        className="mt-1 h-8 w-full justify-start gap-1.5 px-2 text-xs font-medium text-muted-foreground/70 hover:bg-background/60 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        Add a card
      </Button>
    );
  }

  return (
    <div className="mt-1 space-y-1.5">
      <Textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          if (e.key === "Escape") close();
        }}
        placeholder="Enter a title for this card…"
        rows={3}
        className="resize-none text-sm"
      />
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          disabled={!title.trim() || create.isPending}
          onClick={submit}
          className="h-8"
        >
          Add card
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

interface BoardColumnProps {
  status: BoardStatus;
  label: string;
  items: BoardItem[];        // filtered items (for display)
  allItems?: BoardItem[];    // unfiltered items (for SortableContext ids so dnd works while filtering)
  readonly?: boolean;
  cardSettings?: CardViewSettings;
}

export function BoardColumn({ status, label, items, allItems, readonly, cardSettings = DEFAULT_CARD_VIEW_SETTINGS }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const sortableIds = (allItems ?? items).map((i) => i.id);

  return (
    <div className="flex min-w-0 flex-col gap-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT[status])} aria-hidden />
          <span className="text-[12px] font-semibold uppercase tracking-wide text-foreground/80">{label}</span>
        </div>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums leading-none min-w-[1.25rem] text-center", COUNT_PILL[status])}>
          {items.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[18rem] flex-col gap-2 rounded-xl p-2 transition-colors duration-150",
          COLUMN_BG[status],
          isOver && "ring-2 ring-primary/40 ring-offset-1"
        )}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <BoardCard key={item.id} item={item} readonly={readonly} settings={cardSettings} />
          ))}
        </SortableContext>

        {!readonly && <InlineCardCreator status={status} />}

        {items.length === 0 && readonly && (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-xs text-muted-foreground/40">No cards</p>
          </div>
        )}
      </div>
    </div>
  );
}
