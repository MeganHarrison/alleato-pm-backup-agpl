import { cn } from "@/lib/utils";
import type { SuiteType } from "./types";

// Small tonal pill that distinguishes smoke vs feature suites. Pure tonal
// background — no border, no card. Readable at a glance without competing
// with the page typography.
export function SuiteBadge({
  type,
  className,
}: {
  type: SuiteType;
  className?: string;
}) {
  const tone =
    type === "smoke"
      ? "bg-primary/10 text-primary"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone,
        className,
      )}
    >
      {type}
    </span>
  );
}
