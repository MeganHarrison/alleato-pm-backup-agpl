"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// Parses a newline-separated numbered step string into clean items.
function parseSteps(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .filter(Boolean)
    .map((s) => s.replace(/^\d+\.\s*/, "").trim());
}

// The step list is the single most prominent element of the runner view.
// No card wrapper, generous typography, tactile per-step checkboxes.
export function RunnerStepList({ steps }: { steps: string | null }) {
  const parsed = parseSteps(steps);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  if (parsed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No steps recorded for this case.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {parsed.map((step, i) => {
        const isChecked = !!checked[i];
        return (
          <li key={i}>
            <button
              type="button"
              onClick={() =>
                setChecked((prev) => ({ ...prev, [i]: !prev[i] }))
              }
              className={cn(
                "flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                isChecked ? "bg-muted/60" : "hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                  isChecked
                    ? "bg-success text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isChecked ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "text-base leading-relaxed",
                  isChecked
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {step}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
