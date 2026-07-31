"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

type Priority = "HIGH" | "MEDIUM" | "LOW";

interface BrokenItem {
  case_id: string;
  test_number: string;
  test_name: string;
  category: string;
  priority: Priority;
  severity: string | null;
  notes: string | null;
}

interface MissingItem {
  case_id: string;
  test_number: string;
  test_name: string;
  category: string;
  priority: Priority;
  reason: string;
}

interface SuiteParity {
  tool_name: string;
  display_name: string;
  total_cases: number;
  latest_run_id: string | null;
  latest_run_date: string | null;
  counts: {
    pass: number;
    fail: number;
    missing: number;
    skip: number;
    not_tested: number;
  };
  working_pct: number;
  broken: BrokenItem[];
  missing: MissingItem[];
}

interface ParityReport {
  generated_at: string;
  priority_filter: Priority | null;
  totals: { pass: number; fail: number; missing: number; skip: number; not_tested: number };
  suites: SuiteParity[];
}

export default function ParityPage() {
  const [priority, setPriority] = useState<Priority | "ALL">("HIGH");
  const [report, setReport] = useState<ParityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const qs = priority === "ALL" ? "" : `?priority=${priority}`;
      const data = await apiFetch<ParityReport>(`/api/testing/parity${qs}`);
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [priority]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const toggleExpanded = (toolName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  };

  const grandTotals = useMemo(() => {
    if (!report) return null;
    const { pass, fail, missing, skip, not_tested } = report.totals;
    const graded = pass + fail + missing;
    return {
      pass,
      fail,
      missing,
      skip,
      not_tested,
      graded,
      working_pct: graded > 0 ? Math.round((pass / graded) * 100) : 0,
    };
  }, [report]);

  return (
    <PageShell
      variant="content"
      title="Procore Parity Report"
      onBack={() => (window.location.href = "/testing")}
      backLabel="All tests"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Priority:</span>
          {(["HIGH", "MEDIUM", "LOW", "ALL"] as const).map((p) => (
            <Button
              key={p}
              variant={priority === p ? "default" : "outline"}
              size="sm"
              onClick={() => setPriority(p)}
            >
              {p}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={loadReport} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {grandTotals && (
        <div className="grid grid-cols-5 gap-4 mb-8">
          <KpiCard label="Working" value={grandTotals.pass} tone="pass" />
          <KpiCard label="Broken" value={grandTotals.fail} tone="fail" />
          <KpiCard label="Not Built" value={grandTotals.missing} tone="missing" />
          <KpiCard label="Not Tested" value={grandTotals.not_tested} tone="muted" />
          <KpiCard
            label="Parity"
            value={`${grandTotals.working_pct}%`}
            tone="pass"
            subtitle={`${grandTotals.pass}/${grandTotals.graded} graded`}
          />
        </div>
      )}

      {loading && !report && <p className="text-sm text-muted-foreground">Loading…</p>}

      {report && (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full caption-bottom text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="h-10 w-8 px-2 text-left align-middle font-medium text-muted-foreground" />
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Tool</th>
                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Working</th>
                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Broken</th>
                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Not Built</th>
                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Not Tested</th>
                <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Parity</th>
                <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Latest Run</th>
                <th className="h-10 w-24 px-2 text-left align-middle font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {report.suites.map((s) => {
                const isOpen = expanded.has(s.tool_name);
                const hasDetail = s.broken.length > 0 || s.missing.length > 0;
                return (
                  <Fragment key={s.tool_name}>
                    <tr
                      className={cn("border-b border-border", hasDetail && "cursor-pointer hover:bg-muted/50")}
                      onClick={() => hasDetail && toggleExpanded(s.tool_name)}
                    >
                      <td className="p-2 align-middle">
                        {hasDetail ? (
                          isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : null}
                      </td>
                      <td className="p-2 align-middle font-medium">{s.display_name}</td>
                      <td className="p-2 text-right align-middle">
                        <span className="text-success">{s.counts.pass}</span>
                      </td>
                      <td className="p-2 text-right align-middle">
                        <span className={cn(s.counts.fail > 0 && "text-destructive")}>
                          {s.counts.fail}
                        </span>
                      </td>
                      <td className="p-2 text-right align-middle">
                        <span className={cn(s.counts.missing > 0 && "text-warning")}>
                          {s.counts.missing}
                        </span>
                      </td>
                      <td className="p-2 text-right align-middle text-muted-foreground">
                        {s.counts.not_tested}
                      </td>
                      <td className="p-2 text-right align-middle font-mono text-sm">
                        {s.latest_run_id ? `${s.working_pct}%` : "—"}
                      </td>
                      <td className="p-2 align-middle text-sm text-muted-foreground">
                        {s.latest_run_date
                          ? new Date(s.latest_run_date).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="p-2 align-middle">
                        <Link
                          href={`/testing/${s.tool_name}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Run <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                    {isOpen && hasDetail && (
                      <tr className="border-b border-border">
                        <td colSpan={9} className="bg-muted/30 p-6">
                          <div className="grid md:grid-cols-2 gap-6">
                            <DetailList
                              title="Broken (Bugs)"
                              tone="fail"
                              items={s.broken.map((b) => ({
                                key: b.case_id,
                                number: b.test_number,
                                name: b.test_name,
                                category: b.category,
                                priority: b.priority,
                                note: b.notes,
                              }))}
                            />
                            <DetailList
                              title="Not Built (Missing Features)"
                              tone="missing"
                              items={s.missing.map((m) => ({
                                key: m.case_id,
                                number: m.test_number,
                                name: m.test_name,
                                category: m.category,
                                priority: m.priority,
                                note: m.reason,
                              }))}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        Working = feature exists and works. Broken = feature exists but has bugs.
        Not Built = Procore has it, we don&apos;t. Run <code>/parity-audit</code> in
        Claude Code to refresh.
      </p>
    </PageShell>
  );
}

function KpiCard({
  label,
  value,
  tone,
  subtitle,
}: {
  label: string;
  value: number | string;
  tone: "pass" | "fail" | "missing" | "muted";
  subtitle?: string;
}) {
  const toneClasses = {
    pass: "text-success",
    fail: "text-destructive",
    missing: "text-warning",
    muted: "text-muted-foreground",
  }[tone];
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={cn("text-3xl font-semibold", toneClasses)}>{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function DetailList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "fail" | "missing";
  items: Array<{
    key: string;
    number: string;
    name: string;
    category: string;
    priority: Priority;
    note: string | null;
  }>;
}) {
  const badgeClass = tone === "fail" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning";
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3">
        {title}{" "}
        <span className="text-muted-foreground font-normal">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.key} className="text-sm">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className={cn("text-xs shrink-0", badgeClass)}>
                  {item.priority}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {item.number}
                    </span>
                    <span>{item.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.category}
                    {item.note ? ` — ${item.note}` : ""}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
