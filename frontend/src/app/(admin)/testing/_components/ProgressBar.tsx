import { cn } from "@/lib/utils";

// Segmented progress bar for runner view: pass/fail/skip are shown as
// tonal segments proportional to the number of graded cases. Remaining
// width is the "not tested" portion. This replaces the 5-cell KPI grid.
export function ProgressBar({
  pass,
  fail,
  skip,
  notTested,
  className,
}: {
  pass: number;
  fail: number;
  skip: number;
  notTested: number;
  className?: string;
}) {
  const total = pass + fail + skip + notTested;
  if (total === 0) {
    return (
      <div className={cn("h-2 w-full rounded-full bg-muted", className)} />
    );
  }
  const pct = (n: number) => (n / total) * 100;
  const graded = pass + fail + skip;
  const gradedPct = Math.round((graded / total) * 100);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div style={{ width: `${pct(pass)}%` }} className="bg-success" />
        <div style={{ width: `${pct(fail)}%` }} className="bg-destructive" />
        <div style={{ width: `${pct(skip)}%` }} className="bg-muted-foreground/40" />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {graded} of {total} graded ({gradedPct}%)
        </span>
        <span className="flex items-center gap-3">
          <span className="text-success">{pass} pass</span>
          <span className="text-destructive">{fail} fail</span>
          {skip > 0 && <span>{skip} skip</span>}
        </span>
      </div>
    </div>
  );
}
