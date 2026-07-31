"use client";

import { ChevronRight, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function KnowledgeMobileContextBar({
  className,
  currentLabel,
  menuLabel = "Open knowledge menu",
  onOpenMenu,
  rootLabel,
}: {
  className?: string;
  currentLabel: string;
  menuLabel?: string;
  onOpenMenu?: () => void;
  rootLabel: string;
}) {
  return (
    <div className={cn("border-y border-border/60 bg-background lg:hidden", className)}>
      <div className="flex min-h-16 items-center gap-3 px-4 py-2">
        {onOpenMenu ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={menuLabel}
            onClick={onOpenMenu}
            className="h-10 w-10 shrink-0 text-muted-foreground"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <div className="flex min-w-0 items-center gap-2 text-base">
          <span className="truncate text-muted-foreground">{rootLabel}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-semibold text-foreground">{currentLabel}</span>
        </div>
      </div>
    </div>
  );
}
