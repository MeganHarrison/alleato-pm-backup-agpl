"use client";

import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OPEN_ADMIN_FEEDBACK_COMPOSER_EVENT } from "@/lib/admin-feedback/constants";

export function FeedbackButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Share feedback"
      className="h-8 w-8 text-muted-foreground hover:bg-accent hover:text-foreground"
      onClick={() =>
        window.dispatchEvent(new CustomEvent(OPEN_ADMIN_FEEDBACK_COMPOSER_EVENT))
      }
    >
      <Send className="h-4 w-4" />
    </Button>
  );
}
