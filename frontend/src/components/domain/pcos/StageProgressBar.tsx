"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PCO } from "@/hooks/use-pcos";

interface StageProgressBarProps {
  pco: PCO;
}

interface Stage {
  key: string;
  label: string;
}

const stages: Stage[] = [
  { key: "change_events", label: "Change Events" },
  { key: "rfq", label: "RFQ" },
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "official_co", label: "Official CO" },
  { key: "executed", label: "Executed" },
];

function getActiveStageIndex(pco: PCO): number {
  const status = pco.status;
  if (status === "DRAFT") {
    return pco.rfq_required ? 1 : 0;
  }
  if (status === "SUBMITTED") return 2;
  if (status === "UNDER_REVIEW" || status === "REVISION_REQUESTED") return 3;
  if (status === "APPROVED") return 4;
  if (pco.prime_change_order_id) return 5;
  return 0;
}

export function StageProgressBar({ pco }: StageProgressBarProps) {
  const activeIndex = getActiveStageIndex(pco);

  // Filter out RFQ if not required
  const visibleStages = pco.rfq_required
    ? stages
    : stages.filter((s) => s.key !== "rfq");

  // Recalculate active index for visible stages
  const visibleActiveIndex = pco.rfq_required
    ? activeIndex
    : activeIndex > 1
      ? activeIndex - 1
      : activeIndex;

  return (
    <div className="w-full overflow-x-auto py-4">
      <div className="relative flex items-center justify-between min-w-[500px]">
        {/* Connecting line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-border" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-500"
          style={{
            width: `${(visibleActiveIndex / (visibleStages.length - 1)) * 100}%`,
          }}
        />

        {visibleStages.map((stage, index) => {
          const isCompleted = index < visibleActiveIndex;
          const isCurrent = index === visibleActiveIndex;

          return (
            <div key={stage.key} className="relative flex flex-col items-center z-10">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all",
                  isCompleted &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent &&
                    "border-primary bg-background text-primary ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse",
                  !isCompleted &&
                    !isCurrent &&
                    "border-border bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-xs font-medium whitespace-nowrap",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
