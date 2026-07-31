"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow, isPast, differenceInDays } from "date-fns";
import { MessageSquare, Clock, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogContainer,
} from "@/components/motion/morphing-dialog";
import { BoardItemDialog } from "./board-item-dialog";
import type { BoardItem, BoardAssignee } from "./use-product-board";
import type { BoardItemMeta, BoardLabel } from "./use-board-item";
import type { CardViewSettings } from "./card-view-settings";
import { DEFAULT_CARD_VIEW_SETTINGS } from "./card-view-settings";
import { getLinearIssueLink } from "./linear-issue-link";
import { BOARD_CAPTURE_TOPICS, getBoardCaptureTopics } from "./topics";

type BoardItemWithMeta = BoardItem;

// Priority is surfaced only when it carries urgency: high priority reads as a
// red-on-light-red pill (consistent with the other muted tag chips). Medium/low
// are the norm and render nothing — no orange dots (orange is the AI/brain
// accent color and would just blend in rather than differentiate).

function DueDateChip({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const overdue = isPast(date);
  const soon = !overdue && differenceInDays(date, new Date()) <= 2;
  return (
    <span className={cn(
      "flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
      overdue && "bg-destructive/10 text-destructive",
      soon && !overdue && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      !overdue && !soon && "bg-muted text-muted-foreground"
    )}>
      <Clock className="h-2.5 w-2.5" />
      {formatDistanceToNow(date, { addSuffix: true })}
    </span>
  );
}

function LabelStrips({ labels }: { labels: BoardLabel[] }) {
  if (!labels.length) return null;
  return (
    <div className="flex gap-1 mb-2">
      {labels.slice(0, 5).map((l) => (
        <span
          key={l.id}
          title={l.name || l.color}
          className={cn("h-1.5 flex-1 rounded-full", l.color)}
        />
      ))}
    </div>
  );
}

function TopicChips({ topics }: { topics: ReturnType<typeof getBoardCaptureTopics> }) {
  if (!topics.length) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {topics.map((topic) => {
        const config = BOARD_CAPTURE_TOPICS[topic];
        return (
          <span
            key={topic}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", config.color)} />
            {config.label}
          </span>
        );
      })}
    </div>
  );
}

function AssigneeAvatar({ assignee }: { assignee: BoardAssignee }) {
  const initials = assignee.full_name
    ? assignee.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : assignee.email[0].toUpperCase();
  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-foreground"
      title={assignee.full_name ?? assignee.email}
    >
      {initials}
    </div>
  );
}

interface BoardCardProps {
  item: BoardItemWithMeta;
  readonly?: boolean;
  settings?: CardViewSettings;
}

export function BoardCard({ item, readonly, settings = DEFAULT_CARD_VIEW_SETTINGS }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: readonly });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = (item.metadata as BoardItemMeta | null) ?? {};
  const labels = meta.labels ?? [];
  const topics = getBoardCaptureTopics(item);
  const links = meta.links ?? [];
  const dueDate = meta.due_date;
  const isHighPriority = item.severity === "high";
  const primaryLink = getLinearIssueLink(meta) ?? links[0];

  const hasFooter =
    (settings.showDueDate && dueDate) ||
    (settings.showSeverity && isHighPriority) ||
    (settings.showCommentCount && item.comment_count > 0) ||
    (settings.showAssignee && item.assignee);

  return (
    <div ref={setNodeRef} style={style} className={cn("transition-opacity duration-150", isDragging && "opacity-40")}>
      <MorphingDialog transition={{ type: "spring", stiffness: 220, damping: 28 }}>
        <motion.div
          whileHover={!isDragging ? { y: -2, scale: 1.012 } : undefined}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
        >
          <MorphingDialogTrigger
            {...(!readonly ? attributes : {})}
            {...(!readonly ? listeners : {})}
            style={{ borderRadius: "10px" }}
            className={cn(
              "group relative block w-full overflow-hidden bg-background text-left select-none",
              "shadow-[0_1px_0_0_rgb(0_0_0_/_0.04),0_1px_2px_0_rgb(0_0_0_/_0.04)] ring-1 ring-border/60",
              "transition-all duration-200 hover:ring-border hover:shadow-[0_1px_0_0_rgb(0_0_0_/_0.06),0_4px_12px_-4px_rgb(0_0_0_/_0.08)]",
              !readonly && "cursor-pointer"
            )}
          >
            {/* Cover image */}
            {settings.showCover && item.screenshot_url && (
              <div className="relative h-24 w-full overflow-hidden bg-muted/40">
                <img
                  src={item.screenshot_url}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-transparent to-background/70" />
              </div>
            )}

            <div className="p-3">
              <TopicChips topics={topics} />

              {/* Label strips */}
              {settings.showLabels && labels.length > 0 && (
                <LabelStrips labels={labels} />
              )}

              <p className="text-[13px] font-medium leading-snug text-foreground line-clamp-3">
                {item.title}
              </p>

              {/* Description preview */}
              {settings.showDescription && item.comment && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {item.comment}
                </p>
              )}

              {/* Live link chip */}
              {settings.showLinkPreview && primaryLink && (
                <a
                  href={primaryLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                >
                  <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{primaryLink.label}</span>
                </a>
              )}

              {/* Source */}
              {item.page_title && item.page_title !== "Roadmap" && (
                <p className="mt-1 truncate text-[11px] text-muted-foreground/50">
                  from {item.page_title}
                </p>
              )}

              {/* Footer */}
              {hasFooter && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {settings.showDueDate && dueDate && <DueDateChip dateStr={dueDate} />}
                    {settings.showSeverity && isHighPriority && (
                      <span
                        className="inline-flex items-center rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                        title="High priority"
                      >
                        High
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {settings.showCommentCount && item.comment_count > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        {item.comment_count}
                      </span>
                    )}
                    {settings.showAssignee && item.assignee && (
                      <AssigneeAvatar assignee={item.assignee as BoardAssignee} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </MorphingDialogTrigger>
        </motion.div>

        <MorphingDialogContainer overlayClassName="bg-foreground/10 backdrop-blur-sm dark:bg-black/50">
          <MorphingDialogContent
            style={{ borderRadius: "20px" }}
            className="relative w-full max-w-6xl bg-background overflow-hidden mx-4"
          >
            <div style={{ maxHeight: "88vh", overflow: "hidden" }}>
              <BoardItemDialog item={item} />
            </div>
          </MorphingDialogContent>
        </MorphingDialogContainer>
      </MorphingDialog>
    </div>
  );
}

export function BoardCardOverlay({ item }: { item: BoardItem }) {
  return (
    <div className="rounded-xl bg-background p-3 shadow-sm ring-1 ring-primary/30 rotate-1 scale-[1.02] opacity-95">
      <p className="text-[13px] font-medium leading-snug text-foreground line-clamp-2">{item.title}</p>
    </div>
  );
}
