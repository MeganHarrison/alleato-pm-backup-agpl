"use client";

import { Progress, Skeleton } from "@/components/ds";

export function ProgressSkeletonsSection() {
  return (
    <section id="progress" className="scroll-mt-8">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-border">
        <span className="font-mono text-[11px] font-medium text-muted-foreground/40 w-6 shrink-0">
          15
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Progress & Skeletons
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Progress bars for completion states. Skeleton loaders for async
            content — never show blank screens.
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Progress Bars */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Progress Bars
          </h3>
          <div className="rounded-xl bg-card p-6 shadow-sm space-y-6">
            {/* Basic */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-foreground">
                  Budget consumed
                </p>
                <p className="text-[12px] font-mono text-muted-foreground">
                  74%
                </p>
              </div>
              <Progress value={74} />
            </div>

            {/* Low — Safe */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-foreground">
                  Schedule progress
                </p>
                <p className="text-[12px] font-mono text-muted-foreground">
                  32%
                </p>
              </div>
              <Progress
                value={32}
                className="bg-green-100 dark:bg-green-900/20 [&>[data-slot=progress-indicator]]:bg-green-600"
              />
            </div>

            {/* Warning */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-foreground">
                  Change order usage
                </p>
                <p className="text-[12px] font-mono text-amber-600">88%</p>
              </div>
              <Progress
                value={88}
                className="bg-amber-100 dark:bg-amber-900/20 [&>[data-slot=progress-indicator]]:bg-amber-500"
              />
            </div>

            {/* Danger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-foreground">
                  Contingency drawn
                </p>
                <p className="text-[12px] font-mono text-red-600">97%</p>
              </div>
              <Progress
                value={97}
                className="bg-red-100 dark:bg-red-900/20 [&>[data-slot=progress-indicator]]:bg-red-500"
              />
            </div>

            {/* Multi-segment */}
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground">
                Cost breakdown
              </p>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-primary transition-all"
                  style={{ width: "48%" }}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: "28%" }}
                />
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: "16%" }}
                />
                <div
                  className="bg-muted-foreground/20 transition-all"
                  style={{ width: "8%" }}
                />
              </div>
              <div className="flex gap-4">
                {[
                  { label: "Labor", color: "bg-primary", pct: "48%" },
                  { label: "Materials", color: "bg-amber-400", pct: "28%" },
                  { label: "Equipment", color: "bg-green-500", pct: "16%" },
                  {
                    label: "Other",
                    color: "bg-muted-foreground/30",
                    pct: "8%",
                  },
                ].map(({ label, color, pct }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${color}`} />
                    <span className="text-[11px] text-muted-foreground">
                      {label} {pct}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton Loaders */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
            Skeleton Loaders
          </h3>
          <div className="space-y-4">
            {/* KPI Card Skeleton */}
            <div className="rounded-xl bg-card p-5 shadow-sm space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                KPI Card
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-7 w-24" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                ))}
              </div>
            </div>

            {/* Table Row Skeletons */}
            <div className="rounded-xl bg-card p-5 shadow-sm space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Table Rows
              </p>
              <div className="space-y-2">
                {/* Header */}
                <div className="flex gap-4 pb-2 border-b border-border">
                  {[20, 40, 25, 15].map((w, i) => (
                    <Skeleton key={i} className="h-3" style={{ width: `${w}%` }} />
                  ))}
                </div>
                {/* Rows */}
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-4 py-1.5">
                    <Skeleton className="h-3 w-[20%]" />
                    <Skeleton className="h-3 w-[40%]" />
                    <Skeleton className="h-3 w-[25%]" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))}
              </div>
            </div>

            {/* Profile / Detail Skeleton */}
            <div className="rounded-xl bg-card p-5 shadow-sm space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                Detail Panel
              </p>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-8 w-20 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="mt-6 rounded-xl bg-card p-6 shadow-sm">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">
          Step Progress
        </p>
        <div className="relative flex items-center justify-between">
          {/* connecting line */}
          <div className="absolute inset-x-0 top-4 h-px bg-border -z-0" />
          <div
            className="absolute left-0 top-4 h-px bg-primary transition-all -z-0"
            style={{ width: "50%" }}
          />
          {[
            { label: "Draft", done: true },
            { label: "Review", done: true },
            { label: "Approve", done: false, current: true },
            { label: "Execute", done: false },
            { label: "Complete", done: false },
          ].map(({ label, done, current }) => (
            <div key={label} className="relative flex flex-col items-center gap-2 z-10">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors
                  ${done ? "border-primary bg-primary text-primary-foreground" : ""}
                  ${current ? "border-primary bg-background text-primary" : ""}
                  ${!done && !current ? "border-border bg-background text-muted-foreground" : ""}
                `}
              >
                {done ? "✓" : ""}
              </div>
              <span
                className={`text-[11px] font-medium ${done || current ? "text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
