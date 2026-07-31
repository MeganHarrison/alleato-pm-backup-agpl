"use client";

import * as React from "react";
import { RadioTower } from "lucide-react";
import { onboardingCopy, type OnboardingInsight } from "@/lib/onboarding/copy";
import { cn } from "@/lib/utils";

export function WowStep({
  userName,
  insights,
}: {
  userName?: string;
  insights: OnboardingInsight[];
}) {
  const [shown, setShown] = React.useState(0);

  React.useEffect(() => {
    setShown(0);
    const timers = insights.map((_, i) =>
      window.setTimeout(() => setShown((n) => Math.max(n, i + 1)), 250 + i * 350),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [insights]);

  const greeting = userName
    ? onboardingCopy.wow.headlineWithName(userName)
    : onboardingCopy.wow.headlineFallback;

  return (
    <div className="max-w-2xl">
      <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
        <RadioTower className="size-4" />
        {onboardingCopy.wow.badge}
      </div>
      <h1 className="mb-4 max-w-xl text-2xl font-semibold leading-snug tracking-normal text-foreground sm:text-3xl">
        {greeting}
      </h1>
      <p className="mb-6 max-w-xl text-[15px] leading-7 text-muted-foreground">
        {onboardingCopy.wow.body}
      </p>

      <div className="mb-6 grid gap-3">
        {insights.slice(0, 3).map((insight, i) => (
          <InsightRow key={`${insight.kind}-${i}`} insight={insight} visible={i < shown} />
        ))}
      </div>
    </div>
  );
}

function InsightRow({ insight, visible }: { insight: OnboardingInsight; visible: boolean }) {
  const meta = {
    pattern: { label: "Pattern", fg: "text-status-success", bg: "bg-status-success/10" },
    risk: { label: "Risk", fg: "text-status-error", bg: "bg-status-error/10" },
    decision: { label: "Decision", fg: "text-status-info", bg: "bg-status-info/10" },
  }[insight.kind];

  return (
    <div
      className={cn(
        "flex gap-3 border border-border p-4 transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
      )}
    >
      <span
        className={cn(
          "h-fit shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          meta.fg,
          meta.bg,
        )}
      >
        {meta.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] leading-relaxed text-foreground">{insight.text}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{insight.meta}</div>
      </div>
    </div>
  );
}
