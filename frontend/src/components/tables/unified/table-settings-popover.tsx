"use client";

import type { ReactElement, ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Canonical shell for table view, filter, column, and density settings.
 * Keep the shell here so settings surfaces cannot drift in title, spacing,
 * border treatment, or popover sizing.
 */
export function TableSettingsPopover({
  trigger,
  tooltip,
  title = "View settings",
  align = "end",
  children,
  className,
}: {
  trigger: ReactElement;
  tooltip: string;
  title?: string;
  align?: "start" | "center" | "end";
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        align={align}
        className={cn(
          "w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border-border/80 bg-popover p-0 shadow-sm",
          className,
        )}
      >
        <div className="border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <div className="space-y-4 p-4">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
