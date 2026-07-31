"use client";

import { onboardingCopy, type MomentumStats } from "@/lib/onboarding/copy";

export function FoundationStep({
  firstName,
  stats: _stats,
}: {
  firstName?: string;
  stats: MomentumStats;
}) {
  const preheading = firstName
    ? onboardingCopy.foundation.preheadingWithName(firstName)
    : onboardingCopy.foundation.preheadingFallback;

  return (
    <div className="flex h-full max-w-xl flex-col">
      <div className="mb-4 text-base font-medium tracking-normal text-foreground">
        {preheading}
      </div>

      <div className="mb-6 h-1 w-48 bg-primary" />

      <h1 className="mb-5 max-w-lg text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-4xl">
        {onboardingCopy.foundation.headline}
      </h1>

      <div className="max-w-xl space-y-4 text-[15px] leading-7 text-muted-foreground">
        {onboardingCopy.foundation.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}
