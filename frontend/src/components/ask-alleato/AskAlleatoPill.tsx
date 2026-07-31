"use client";

import { ListFilter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE,
  FEEDBACK_LAUNCHER_POSITION_CLASS,
  feedbackTargetProps,
} from "@/lib/admin-feedback/constants";
import { cn } from "@/lib/utils";

export function AskAlleatoPill({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      size="icon"
      className={cn(
        FEEDBACK_LAUNCHER_POSITION_CLASS,
        "flex size-12 items-center justify-center rounded-full border-border bg-background text-foreground shadow-sm transition-all hover:bg-muted",
      )}
      aria-label="Feedback mode"
      {...feedbackTargetProps("ask-alleato.pill")}
      {...{ [ADMIN_FEEDBACK_OVERLAY_ATTRIBUTE]: "true" }}
    >
      <ListFilter className="size-5" />
    </Button>
  );
}
