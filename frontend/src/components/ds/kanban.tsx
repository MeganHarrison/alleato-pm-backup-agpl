"use client";

import type * as React from "react";
import { forwardRef } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type KanbanTone = "neutral" | "info" | "warning" | "success" | "primary";

const columnToneClasses: Record<KanbanTone, string> = {
  neutral: "bg-muted/20",
  info: "bg-status-info/5",
  warning: "bg-status-warning/5",
  success: "bg-status-success/5",
  primary: "bg-primary/5",
};

export const kanbanPriorityDotClasses = {
  urgent: "bg-destructive",
  high: "bg-destructive/70",
  medium: "bg-status-warning",
  low: "bg-status-info",
} as const;

export const kanbanDensityStyles = {
  compact: {
    cardPadding: "p-2",
    gap: "space-y-1",
    titleClass: "text-xs",
    showDescription: false,
  },
  default: {
    cardPadding: "p-3",
    gap: "space-y-2",
    titleClass: "text-sm",
    showDescription: true,
  },
  spacious: {
    cardPadding: "p-4",
    gap: "space-y-3",
    titleClass: "text-sm",
    showDescription: true,
  },
} as const;

interface KanbanColumnShellProps {
  title: string;
  icon?: React.ReactNode;
  count: number;
  tone?: KanbanTone;
  onAdd?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function KanbanColumnShell({
  title,
  icon,
  count,
  tone = "neutral",
  onAdd,
  children,
  className,
}: KanbanColumnShellProps) {
  return (
    <div
      className={cn(
        "flex min-w-72 flex-1 flex-col",
        columnToneClasses[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/10 px-1.5 text-xs font-medium text-foreground">
            {count}
          </span>
        </div>
        {onAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={onAdd}
            aria-label={`Add ${title} card`}
          >
            <Plus />
          </Button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">{children}</div>
    </div>
  );
}

interface KanbanEmptyActionProps {
  children: React.ReactNode;
  onClick: () => void;
}

export function KanbanEmptyAction({ children, onClick }: KanbanEmptyActionProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="h-auto w-full border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground hover:border-border hover:bg-muted/30"
    >
      {children}
    </Button>
  );
}

interface KanbanCardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  density: keyof typeof kanbanDensityStyles | { cardPadding: string };
  interactive?: boolean;
  className?: string;
  sortStyle?: React.CSSProperties;
  ariaLabel?: string;
}

export const KanbanCardShell = forwardRef<HTMLDivElement, KanbanCardShellProps>(
function KanbanCardShell(
  {
    children,
    density,
    interactive = false,
    className,
    sortStyle,
    ariaLabel,
    ...props
  },
  ref,
) {
  const cardPadding =
    typeof density === "string" ? kanbanDensityStyles[density].cardPadding : density.cardPadding;

  return (
    <div
      ref={ref}
      style={sortStyle}
      className={cn(
        "group rounded-lg border border-border/60 bg-card shadow-xs transition-shadow hover:shadow-sm",
        cardPadding,
        interactive && "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      {...props}
    >
      {children}
    </div>
  );
});
