"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface Finding {
  gap_id: string;
  layer: string;
  severity: string;
  status: string;
  title?: string;
  description?: string;
  spec_ref?: string;
  code_ref?: string;
  evidence?: string;
  acceptance_criteria?: string;
}

interface GapData {
  feature: string;
  findings: Finding[];
  summary: { total: number; open: number; resolved: number } | null;
  generated_at: string | null;
}

interface Props {
  feature: string | null;
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function relativeTime(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function implementationScore(findings: { status: string }[]) {
  if (findings.length === 0) return null;
  const resolved = findings.filter((f) => f.status === "resolved" || f.status === "waived").length;
  return Math.round((resolved / findings.length) * 100);
}

const severityColor: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300",
  medium:   "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  low:      "bg-muted text-muted-foreground border-border",
};

const statusColor: Record<string, string> = {
  open:     "text-red-600 dark:text-red-400",
  resolved: "text-emerald-600 dark:text-emerald-400",
  waived:   "text-muted-foreground",
  blocked:  "text-amber-600 dark:text-amber-400",
};

const layerColor: Record<string, string> = {
  db:       "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  api:      "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ui:       "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  workflow: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  tests:    "bg-muted text-muted-foreground",
};

export function GapsTab({ feature }: Props) {
  const [data, setData] = React.useState<GapData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<string>("open");

  React.useEffect(() => {
    if (!feature) return;
    setLoading(true);
    fetch(`/api/dev-panel/gaps/${feature}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [feature]);

  if (loading) return <Empty>Loading gap analysis…</Empty>;
  if (!feature || !data) return <Empty>No gap analysis available for this page.</Empty>;
  if (data.findings.length === 0) return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <p>No gap analysis found for <span className="font-medium capitalize">{feature.replace(/-/g, " ")}</span>.</p>
      <p className="text-xs">Run <code className="rounded bg-muted px-1">/procore-gap-audit {feature}</code> to generate one.</p>
    </div>
  );

  const sorted = [...data.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
  const filtered = filter === "all" ? sorted : sorted.filter((f) => f.status === filter);

  const openCount = data.findings.filter((f) => f.status === "open").length;
  const resolvedCount = data.findings.filter((f) => f.status === "resolved").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-2">
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="text-muted-foreground">
            {data.findings.length} findings
            {data.generated_at && (
              <span className={cn("ml-2", Date.now() - new Date(data.generated_at).getTime() > 14 * 86_400_000 ? "text-amber-500" : "text-muted-foreground/60")}>
                · {relativeTime(data.generated_at)}
                {Date.now() - new Date(data.generated_at).getTime() > 14 * 86_400_000 && " — consider re-running"}
              </span>
            )}
          </span>
          <span className="text-red-600 dark:text-red-400">{openCount} open</span>
          <span className="text-emerald-600 dark:text-emerald-400">{resolvedCount} resolved</span>
          {(() => { const score = implementationScore(data.findings); return score !== null ? (
            <span className={cn("font-semibold", score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600")}>
              {score}% done
            </span>
          ) : null; })()}
        </div>
        <div className="flex items-center gap-1">
          {["all", "open", "resolved", "waived"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] capitalize transition-colors",
                filter === s
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <Empty>No {filter} findings.</Empty>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((f) => (
              <div key={f.gap_id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-2 mb-1">
                  <code className="shrink-0 text-[10px] text-muted-foreground">{f.gap_id}</code>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", severityColor[f.severity] ?? severityColor.low)}>
                    {f.severity}
                  </span>
                  <span className={cn("text-[10px] font-medium capitalize", layerColor[f.layer] ?? "", "rounded px-1.5 py-0.5")}>
                    {f.layer}
                  </span>
                  <span className={cn("ml-auto text-[10px] font-medium capitalize", statusColor[f.status] ?? "")}>
                    {f.status}
                  </span>
                </div>
                {f.title && <p className="text-xs font-medium text-foreground">{f.title}</p>}
                {f.description && (
                  <p className={cn("leading-relaxed text-[11px] text-muted-foreground", f.title ? "mt-0.5" : "mt-0 text-xs font-medium text-foreground")}>
                    {f.description}
                  </p>
                )}
                {f.acceptance_criteria && (
                  <p className="mt-1.5 rounded bg-muted/60 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground/70">Acceptance: </span>
                    {f.acceptance_criteria}
                  </p>
                )}
                {f.code_ref && (
                  <p className="mt-1 text-[10px] font-mono text-muted-foreground/70 truncate">{f.code_ref}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
