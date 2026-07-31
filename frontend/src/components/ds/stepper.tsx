"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  description?: string;
}

type StepStatus = "complete" | "current" | "upcoming";

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

function getStatus(index: number, currentStep: number): StepStatus {
  if (index < currentStep) return "complete";
  if (index === currentStep) return "current";
  return "upcoming";
}

export function Stepper({
  steps,
  currentStep,
  className,
  orientation = "horizontal",
}: StepperProps) {
  if (orientation === "vertical") {
    return (
      <VerticalStepper steps={steps} currentStep={currentStep} className={className} />
    );
  }
  return (
    <HorizontalStepper steps={steps} currentStep={currentStep} className={className} />
  );
}

function HorizontalStepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const status = getStatus(i, currentStep);
          const isLast = i === steps.length - 1;
          return (
            <li key={step.id} className={cn("flex flex-col items-center", !isLast && "flex-1")}>
              {/* Circle + connector line */}
              <div className="flex w-full items-center">
                <StepCircle status={status} index={i} />
                {!isLast && (
                  <div
                    className={cn(
                      "h-px flex-1 transition-colors duration-300",
                      status === "complete" ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
              </div>
              {/* Label */}
              <div className="mt-2 w-full pr-4">
                <p
                  className={cn(
                    "text-xs font-medium leading-tight",
                    status === "current" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground/60 leading-tight">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function VerticalStepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      <ol className="space-y-0">
        {steps.map((step, i) => {
          const status = getStatus(i, currentStep);
          const isLast = i === steps.length - 1;
          return (
            <li key={step.id} className="relative flex gap-4">
              {!isLast && (
                <div
                  className={cn(
                    "absolute left-[15px] top-8 bottom-0 w-px transition-colors duration-300",
                    status === "complete" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <div className="relative z-10 mt-0.5 shrink-0">
                <StepCircle status={status} index={i} />
              </div>
              <div className={cn("min-w-0 flex-1", !isLast && "pb-8")}>
                <p
                  className={cn(
                    "text-sm font-medium leading-none pt-1.5",
                    status === "current" ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepCircle({ status, index }: { status: StepStatus; index: number }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-4 transition-all duration-300",
        status === "complete" &&
          "bg-primary text-primary-foreground ring-primary/15",
        status === "current" &&
          "border-2 border-primary bg-background text-primary ring-primary/15 shadow-sm",
        status === "upcoming" &&
          "border border-border bg-muted text-muted-foreground ring-background",
      )}
    >
      {status === "complete" ? (
        <Check className="h-4 w-4 stroke-[2.5]" />
      ) : (
        <span>{index + 1}</span>
      )}
    </div>
  );
}
