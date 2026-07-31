"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "info";
  user?: string;
}

const variantDotClasses: Record<NonNullable<TimelineItem["variant"]>, string> = {
  default: "bg-muted-foreground/40 ring-muted-foreground/20",
  success: "bg-status-success ring-status-success/20",
  warning: "bg-status-warning ring-status-warning/20",
  destructive: "bg-destructive ring-destructive/20",
  info: "bg-primary ring-primary/20",
};

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn("space-y-0", className)}>
      {items.map((item, i) => (
        <TimelineEntry key={item.id} item={item} isLast={i === items.length - 1} />
      ))}
    </ol>
  );
}

function TimelineEntry({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const variant = item.variant ?? "default";
  return (
    <li className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
      )}

      {/* Dot / icon */}
      <div className="relative z-10 mt-1 flex-shrink-0">
        {item.icon ? (
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full ring-4 text-background",
            variantDotClasses[variant],
          )}>
            {item.icon}
          </div>
        ) : (
          <div className={cn(
            "h-2.5 w-2.5 mt-1.5 ml-1.5 rounded-full ring-4",
            variantDotClasses[variant],
          )} />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
          <time className="shrink-0 text-xs text-muted-foreground/70 mt-0.5">{item.timestamp}</time>
        </div>
        {item.user && (
          <p className="mt-0.5 text-xs text-muted-foreground">{item.user}</p>
        )}
        {item.description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>
    </li>
  );
}
