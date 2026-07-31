"use client";

import * as React from "react";
import { Bug, HelpCircle, ImagePlus, Lightbulb, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { onboardingCopy } from "@/lib/onboarding/copy";
import { type AskAlleatoFeedbackTag } from "@/lib/ask-alleato/feedback-tag-mapping";
import { cn } from "@/lib/utils";

export function WidgetShowcaseStep() {
  return (
    <div className="grid gap-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
      <div>
        <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
          <MessageSquare className="size-4" />
          Client feedback
        </div>
        <h1 className="mb-4 text-2xl font-semibold leading-snug tracking-normal text-foreground sm:text-3xl">
          {onboardingCopy.widget.headline}
        </h1>
        <p className="mb-6 text-[15px] leading-7 text-muted-foreground">
          {onboardingCopy.widget.body}
        </p>
      </div>

      <FeedbackPreview />
    </div>
  );
}

export function FeedbackPreview({ compact = false }: { compact?: boolean }) {
  const [tag, setTag] = React.useState<AskAlleatoFeedbackTag | null>(null);
  return (
    <div className="border border-border bg-background p-4 text-foreground">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Submit feedback</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Bugs, missing details, ideas, or “this should work differently.”
          </div>
        </div>
        <MessageSquare className="size-4 text-primary" />
      </div>
      <Textarea
        placeholder={onboardingCopy.widget.feedbackPlaceholder}
        className={cn(
          "bg-background text-[13px]",
          compact ? "min-h-20" : "min-h-28",
        )}
        readOnly
      />
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <TagButton label="Bug" icon={Bug} active={tag === "Bug"} onClick={() => setTag("Bug")} />
        <TagButton label="Idea" icon={Lightbulb} active={tag === "Idea"} onClick={() => setTag("Idea")} />
        <TagButton label="Confused" icon={HelpCircle} active={tag === "Confused"} onClick={() => setTag("Confused")} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <Button size="sm" variant="outline" className="h-8" disabled>
          <ImagePlus className="mr-1.5 size-3" />
          Add screenshot
        </Button>
        <Button size="sm" className="h-8 bg-primary text-primary-foreground" disabled>
          <Send className="mr-1.5 size-3" />
          Send feedback
        </Button>
      </div>
      <div className="mt-2.5 text-[11px] leading-5 text-muted-foreground">
        {onboardingCopy.widget.feedbackFooter}
      </div>
    </div>
  );
}

function TagButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: AskAlleatoFeedbackTag;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full text-[11px]",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "bg-background text-muted-foreground hover:border-primary/30 hover:text-primary",
      )}
    >
      <Icon className="size-3" />
      {label}
    </Button>
  );
}
