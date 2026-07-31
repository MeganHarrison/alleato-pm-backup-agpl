"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, MinusCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Sticky bottom action bar for the runner. Pass is primary (emerald tonal),
// fail is destructive tonal, skip is neutral. No card wrapper — just a
// surface-colored strip with a top hairline.
export function RunnerActionBar({
  onPass,
  onFail,
  onSkip,
  disabled,
  className,
}: {
  onPass: () => void;
  onFail: () => void;
  onSkip: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 -mx-4 mt-12 border-t border-border bg-background/95 px-4 py-4 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Button
          type="button"
          onClick={onPass}
          disabled={disabled}
          className="flex-1 gap-2 bg-success text-primary-foreground hover:bg-success/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          Pass
          <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">P</kbd>
        </Button>
        <Button
          type="button"
          onClick={onFail}
          disabled={disabled}
          variant="destructive"
          className="flex-1 gap-2"
        >
          <XCircle className="h-4 w-4" />
          Report Issue
          <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">I</kbd>
        </Button>
        <Button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          variant="outline"
          className="gap-2"
        >
          <MinusCircle className="h-4 w-4" />
          Skip
          <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">S</kbd>
        </Button>
      </div>
    </div>
  );
}
