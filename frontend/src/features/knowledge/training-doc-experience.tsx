"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SectionRuleHeading } from "@/components/layout/spacing";
import type { TrainingDocStep } from "@/lib/training-docs/types";
import { cn } from "@/lib/utils";

export type TrainingDocExperienceMode = "annotated" | "walkthrough";

export interface TrainingDocFocus {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ExperienceStep extends TrainingDocStep {
  focus: TrainingDocFocus;
}

export function getTrainingDocFocus(
  metadata: Record<string, unknown>,
): TrainingDocFocus | null {
  const focus = metadata.focus;
  if (!focus || typeof focus !== "object" || Array.isArray(focus)) return null;

  const candidate = focus as Record<string, unknown>;
  const values = [candidate.x, candidate.y, candidate.width, candidate.height];
  if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return null;
  }

  const [x, y, width, height] = values as number[];
  if (
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > 1 ||
    y + height > 1
  ) {
    return null;
  }

  return { x, y, width, height };
}

export function TrainingDocExperience({
  articleHref,
  mode,
  steps,
}: {
  articleHref: string;
  mode: TrainingDocExperienceMode;
  steps: TrainingDocStep[];
}) {
  const screenshotSteps = steps.filter((step) => step.screenshot_asset?.signed_url);
  const experienceSteps = screenshotSteps.map((step) => ({
    ...step,
    focus: getTrainingDocFocus(step.action_metadata),
  }));
  const missingFocusStep = experienceSteps.find((step) => !step.focus);

  if (!experienceSteps.length || missingFocusStep) {
    return (
      <section className="max-w-3xl space-y-3" aria-labelledby="experience-unavailable-title">
        <SectionRuleHeading
          className="mb-0"
          label={mode === "annotated" ? "Annotated view unavailable" : "Guide me unavailable"}
        />
        <p className="text-sm leading-6 text-muted-foreground">
          This view needs a verified focus capture for every screenshot. The published article
          remains available while this training timeline is refreshed.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={articleHref}>Open article view</Link>
        </Button>
      </section>
    );
  }

  const verifiedSteps = experienceSteps as ExperienceStep[];
  return mode === "annotated" ? (
    <AnnotatedExperience steps={verifiedSteps} />
  ) : (
    <WalkthroughExperience steps={verifiedSteps} />
  );
}

function AnnotatedExperience({ steps }: { steps: ExperienceStep[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeStep = steps[activeIndex]!;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <ExperienceScreenshot step={activeStep} transitionKey={`annotated-${activeStep.id}`} />
      <aside className="space-y-6 border-l border-border pl-6" aria-label="Step explanation">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Step {activeIndex + 1} of {steps.length}
          </p>
          <p className="text-lg font-semibold tracking-tight text-foreground">{activeStep.title}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            {activeStep.instruction_markdown}
          </p>
        </div>
        {activeStep.expected_result ? (
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Expected result:</span>{" "}
            {activeStep.expected_result}
          </p>
        ) : null}
        <div className="space-y-1" aria-label="Annotated steps">
          {steps.map((step, index) => (
            <Button
              key={step.id}
              className={cn(
                "block h-auto w-full justify-start px-2 py-2 text-left",
                index === activeIndex
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              onClick={() => setActiveIndex(index)}
              size="sm"
              variant="ghost"
            >
              <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
              {step.title}
            </Button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function WalkthroughExperience({ steps }: { steps: ExperienceStep[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeStep = steps[activeIndex]!;

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  const moveToStep = (nextIndex: number) => {
    if (isTransitioning || nextIndex < 0 || nextIndex >= steps.length) return;
    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      setActiveIndex(nextIndex);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <section
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
      aria-label="Guide me walkthrough"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveToStep(activeIndex - 1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveToStep(activeIndex + 1);
        }
      }}
    >
      <ExperienceScreenshot
        step={activeStep}
        transitionKey={`walkthrough-screen-${activeStep.id}`}
        isTransitioning={isTransitioning}
      />
      <aside
        key={`walkthrough-guide-${activeStep.id}`}
        className={cn(
          "flex min-h-96 flex-col justify-between rounded-[20px] bg-card p-6 shadow-sm motion-reduce:animate-none",
          isTransitioning
            ? "animate-out fade-out-0 slide-out-to-right-1 duration-150 ease-in"
            : "animate-in fade-in-0 slide-in-from-right-1 duration-300 ease-out",
        )}
      >
        <div className="space-y-4" aria-live="polite">
          <p className="text-sm font-medium text-primary">
            Step {activeIndex + 1} of {steps.length}
          </p>
          <p className="text-xl font-semibold tracking-tight text-foreground">{activeStep.title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{activeStep.instruction_markdown}</p>
          {activeStep.expected_result ? (
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">Expected result:</span>{" "}
              {activeStep.expected_result}
            </p>
          ) : null}
        </div>
        <div className="space-y-4">
          <div
            aria-label={`Walkthrough progress, step ${activeIndex + 1} of ${steps.length}`}
            aria-valuemax={steps.length}
            aria-valuemin={1}
            aria-valuenow={activeIndex + 1}
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
          >
            <div
              className="h-full origin-left bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${(activeIndex + 1) / steps.length})` }}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              disabled={activeIndex === 0 || isTransitioning}
              onClick={() => moveToStep(activeIndex - 1)}
              size="sm"
              variant="ghost"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              disabled={activeIndex === steps.length - 1 || isTransitioning}
              onClick={() => moveToStep(activeIndex + 1)}
              size="sm"
            >
              Next
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
    </section>
  );
}

function ExperienceScreenshot({
  isTransitioning = false,
  step,
  transitionKey,
}: {
  isTransitioning?: boolean;
  step: ExperienceStep;
  transitionKey: string;
}) {
  const asset = step.screenshot_asset!;
  return (
    <figure
      key={transitionKey}
      className={cn(
        "relative overflow-hidden rounded-md border border-border motion-reduce:animate-none",
        isTransitioning
          ? "animate-out fade-out-0 slide-out-to-left-1 duration-150 ease-in"
          : "animate-in fade-in-0 slide-in-from-left-1 duration-300 ease-out",
      )}
    >
      <img
        alt={asset.alt_text ?? asset.file_name}
        className="block h-auto w-full"
        src={asset.signed_url!}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-md border-2 border-primary bg-primary/10 shadow-sm"
        style={{
          height: `${step.focus.height * 100}%`,
          left: `${step.focus.x * 100}%`,
          top: `${step.focus.y * 100}%`,
          width: `${step.focus.width * 100}%`,
        }}
      />
      {asset.caption ? (
        <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          {asset.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
