"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalTitle } from "@/components/ui/unified-modal";
import { apiFetch } from "@/lib/api-client";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import {
  defaultMomentumStats,
  onboardingCopy,
  ONBOARDING_VISIBILITY_EVENT,
  WELCOME_ONBOARDING_STORAGE_KEY,
  type MomentumStats,
} from "@/lib/onboarding/copy";
import { findAlleatoAiProfile } from "@/config/aiPersonalization";
import { resolveAssistantSuggestions } from "@/lib/ai/assistant-suggestion-resolver";
import { cn } from "@/lib/utils";
import { IntroFeedbackStep } from "./steps/IntroFeedbackStep";
import { MissionStep } from "./steps/MissionStep";

export type WelcomeOnboardingProps = {
  forceOpen?: boolean;
  stats?: MomentumStats;
  storageKey?: string;
  deferAutoOpen?: boolean;
  suppressAutoOpen?: boolean;
  suppressStorageValue?: string;
};

const TOTAL_STEPS = 2;

export function WelcomeOnboarding({
  forceOpen,
  stats = defaultMomentumStats,
  storageKey = WELCOME_ONBOARDING_STORAGE_KEY,
  deferAutoOpen = false,
  suppressAutoOpen = false,
  suppressStorageValue = "skipped",
}: WelcomeOnboardingProps) {
  const searchParams = useSearchParams()!;
  const { profile: currentUserProfile } = useCurrentUserProfile();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const queryForceOpen = searchParams?.get("onboarding") === "1";

  const personalizationProfile = React.useMemo(
    () =>
      findAlleatoAiProfile({
        email: currentUserProfile?.email,
        displayName: currentUserProfile?.fullName,
      }),
    [currentUserProfile?.email, currentUserProfile?.fullName],
  );

  const userName =
    currentUserProfile?.fullName || personalizationProfile.displayName;
  const firstName = userName.trim().split(/\s+/)[0] || undefined;
  const aiActionLinks = React.useMemo(
    () =>
      resolveAssistantSuggestions({
        pathname: "/welcome",
        surface: "onboarding",
        maxSuggestions: 4,
      }).flatMap((suggestion) =>
        suggestion.href ? [{ ...suggestion, href: suggestion.href }] : [],
      ),
    [],
  );

  React.useEffect(() => {
    const shouldForceOpen =
      forceOpen ||
      queryForceOpen ||
      new URLSearchParams(window.location.search).get("onboarding") === "1";

    if (!shouldForceOpen && deferAutoOpen) {
      return;
    }
    if (!shouldForceOpen && suppressAutoOpen) {
      window.localStorage.setItem(storageKey, suppressStorageValue);
      setOpen(false);
      return;
    }

    if (shouldForceOpen) {
      setStep(0);
      setOpen(true);
      return;
    }

    // Server-side flag is authoritative — if the DB says completed, never show again.
    if (currentUserProfile?.onboardingCompletedAt) {
      window.localStorage.setItem(storageKey, currentUserProfile.onboardingCompletedAt);
      return;
    }

    // Fall back to localStorage while the profile is loading or as a fast cache.
    const seen = window.localStorage.getItem(storageKey);
    if (!seen) {
      setStep(0);
      setOpen(true);
    }
  }, [
    currentUserProfile?.onboardingCompletedAt,
    deferAutoOpen,
    forceOpen,
    queryForceOpen,
    storageKey,
    suppressAutoOpen,
    suppressStorageValue,
  ]);

  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(ONBOARDING_VISIBILITY_EVENT, { detail: { open } }),
    );
    document.documentElement.dataset.alleatoOnboardingOpen = open ? "true" : "false";
    return () => {
      window.dispatchEvent(
        new CustomEvent(ONBOARDING_VISIBILITY_EVENT, { detail: { open: false } }),
      );
      document.documentElement.dataset.alleatoOnboardingOpen = "false";
    };
  }, [open]);

  const close = React.useCallback(
    (_completed: boolean) => {
      const now = new Date().toISOString();
      window.localStorage.setItem(storageKey, now);
      setOpen(false);
      // Fire-and-forget — mark as completed in the DB so it never shows again on any device.
      apiFetch("/api/users/me/onboarding", { method: "POST" }).catch(() => {});
    },
    [storageKey],
  );

  const next = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1);
      return;
    }
    close(true);
  };

  const back = () => setStep((current) => Math.max(0, current - 1));

  const handleCreateTestProject = () => {
    close(true);
    window.location.assign("/create-project");
  };

  return (
    <Modal open={open} onOpenChange={(nextOpen) => !nextOpen && close(false)}>
      <ModalContent
        hideCloseButton={true}
        className="flex max-h-[calc(100svh-1.5rem)] flex-col gap-0 overflow-hidden border-0 bg-background p-0 text-foreground sm:max-w-5xl"
        style={{ height: "min(42rem, calc(100svh - 1.5rem))" }}
        aria-describedby={undefined}
      >
        <ModalTitle className="sr-only">Welcome to Alleato AI</ModalTitle>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <BlueprintBackdrop />

          <div className="relative flex items-center justify-end px-6 pt-4 sm:px-12 sm:pt-5">
            <div className="flex items-center gap-3">
              <StepDots current={step} total={TOTAL_STEPS} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => close(false)}
                className="size-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close welcome"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:min-h-96 sm:px-12 sm:py-8">
            {step === 0 && <IntroFeedbackStep firstName={firstName} stats={stats} />}
            {step === 1 && <MissionStep onCreateTestProject={handleCreateTestProject} />}
          </div>

          <div className="relative flex flex-col gap-4 px-6 pb-6 pt-7 sm:px-12 sm:pb-8 sm:pt-10 md:flex-row md:items-center md:justify-between">
            {aiActionLinks.length > 0 && (
              <nav
                aria-label="AI onboarding actions"
                className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground"
              >
                {aiActionLinks.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {action.label}
                  </Link>
                ))}
              </nav>
            )}
            <div className="flex gap-2">
              {step > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={back}
                  className="h-9 px-0 text-[12px] font-medium uppercase tracking-[0.2em] text-muted-foreground underline-offset-4 hover:bg-transparent hover:text-foreground hover:underline"
                >
                  {onboardingCopy.shell.back}
                </Button>
              )}
              {step < TOTAL_STEPS - 1 && (
                <Button
                  size="sm"
                  onClick={next}
                  className="bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                >
                  {onboardingCopy.shell.continue}
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-2 rounded-full transition-all",
            index === current
              ? "w-6 bg-primary"
              : index < current
                ? "w-2 bg-foreground/65"
                : "w-2 bg-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

function BlueprintBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-primary/5">
      <div className="absolute inset-0 opacity-55">
        <div className="absolute inset-x-0 top-16 h-px bg-primary/15" />
        <div className="absolute inset-x-0 top-32 h-px bg-primary/15" />
        <div className="absolute inset-x-0 top-48 h-px bg-primary/15" />
        <div className="absolute inset-y-0 left-16 w-px bg-primary/15" />
        <div className="absolute inset-y-0 left-32 w-px bg-primary/15" />
        <div className="absolute inset-y-0 left-48 w-px bg-primary/15" />
        <div className="absolute inset-y-0 right-16 w-px bg-primary/15" />
        <div className="absolute inset-y-0 right-32 w-px bg-primary/15" />
      </div>
      <div className="absolute bottom-14 right-14 hidden h-40 w-64 border border-primary/15 md:block" />
      <div className="absolute bottom-24 right-28 hidden h-px w-72 rotate-[-12deg] bg-primary/15 md:block" />
      <div className="absolute bottom-20 left-16 hidden h-24 w-40 border border-primary/10 md:block" />
      <div className="absolute left-20 top-28 hidden h-px w-56 rotate-[-18deg] bg-primary/10 md:block" />
    </div>
  );
}
