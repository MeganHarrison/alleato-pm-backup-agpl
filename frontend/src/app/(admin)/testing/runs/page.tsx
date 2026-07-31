"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout";
import { apiFetch } from "@/lib/api-client";
import { EmptyState } from "@/components/ds";
import { History } from "lucide-react";
import { SuiteBadge } from "../_components/SuiteBadge";
import type { HistoryRun, Suite } from "../_components/types";
import { cn } from "@/lib/utils";

interface RunRow {
  run: HistoryRun;
  suiteName: string;
  suiteDisplayName: string;
}

// Maps tool_name -> suite_type -> display_name for accurate per-run labeling
type SuiteDisplayMap = Map<string, Map<string, string>>;

// Unified runs index: in-progress + history on one page, separated by a
// subtle section heading rather than tab chrome.
export default function RunsPage() {
  const [rows, setRows] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const suitesRes = await apiFetch<{ suites: Suite[] }>(
          "/api/testing/suites",
        );
        const suites = suitesRes.suites ?? [];
        // De-duplicate by tool_name to get one fetch per tool.
        const uniqueToolNames = Array.from(new Set(suites.map((s) => s.tool_name)));
        // Build display name map: tool_name -> suite_type -> display_name
        const displayMap: SuiteDisplayMap = new Map();
        for (const s of suites) {
          if (!displayMap.has(s.tool_name)) displayMap.set(s.tool_name, new Map());
          displayMap.get(s.tool_name)!.set(s.suite_type, s.display_name);
        }
        const results = await Promise.allSettled(
          uniqueToolNames.map((toolName) =>
            apiFetch<{ runs?: HistoryRun[] }>(
              `/api/testing/runs?suite=${toolName}`,
            ).then((data) => ({
              toolName,
              runs: data.runs ?? [],
            })),
          ),
        );
        const flattened: RunRow[] = [];
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          for (const run of r.value.runs) {
            const typeMap = displayMap.get(r.value.toolName);
            const displayName = typeMap?.get(run.suite_type)
              ?? typeMap?.values().next().value
              ?? r.value.toolName;
            flattened.push({
              run,
              suiteName: r.value.toolName,
              suiteDisplayName: displayName,
            });
          }
        }
        flattened.sort(
          (a, b) =>
            new Date(b.run.run_date).getTime() -
            new Date(a.run.run_date).getTime(),
        );
        setRows(flattened);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load runs.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const { inProgress, completed } = useMemo(() => {
    const ip: RunRow[] = [];
    const cp: RunRow[] = [];
    for (const r of rows) {
      if (r.run.not_tested > 0) ip.push(r);
      else if (r.run.total > 0) cp.push(r);
    }
    return { inProgress: ip, completed: cp };
  }, [rows]);

  return (
    <PageShell
      variant="content"
      title="Test runs"
      description="All in-progress and completed test runs across every tool."
    >
      {error && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading runs…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="No runs yet"
          description="Start a test run from a tool page to see it here."
        />
      ) : (
        <div className="space-y-10">
          <RunSection title="In progress" rows={inProgress} />
          <RunSection title="Completed" rows={completed} />
        </div>
      )}
    </PageShell>
  );
}

function RunSection({ title, rows }: { title: string; rows: RunRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} ({rows.length})
      </h2>
      <ul className="divide-y divide-border">
        {rows.map(({ run, suiteName, suiteDisplayName }) => {
          const pct =
            run.total > 0
              ? Math.round(((run.pass + run.fail + run.skip) / run.total) * 100)
              : 0;
          return (
            <li key={run.id}>
              <Link
                href={`/testing/runs/${run.slug ?? run.id}`}
                className="group flex items-center gap-4 px-1 py-4 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      {suiteDisplayName}
                    </p>
                    <SuiteBadge type={run.suite_type} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(run.run_date).toLocaleString()}
                    {run.tester ? ` · ${run.tester}` : ""}
                    {run.branch ? ` · ${run.branch}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs">
                  <span className="text-success">{run.pass}</span>
                  <span
                    className={cn(
                      run.fail > 0 ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {run.fail}
                  </span>
                  <span className="w-10 text-right font-mono text-muted-foreground">
                    {pct}%
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
