"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InfoAlert } from "@/components/ds";
import { apiFetch } from "@/lib/api-client";
import { createLookaheadPdf, createLookaheadWorkbook } from "@/lib/scheduling/schedule-lookahead-export";

type LookaheadActivity = {
  sourceTaskId: string;
  name: string;
  forecastStartDate: string | null;
  forecastFinishDate: string | null;
  constraint: { type: string; date: string } | null;
  dependencies: Array<{ predecessorSourceId: string; type: string; lagDays: number }>;
  submittalRisk: { status: "clear" | "at_risk"; reason?: string };
};

export type ScheduleLookaheadData = {
  revisionId: string;
  revisionNumber: number;
  snapshotProvenance: "captured" | "reconstructed";
  window: { startDate: string; endDate: string; weeks: 2 | 3 | 6 };
  activities: LookaheadActivity[];
};

type Props = {
  projectId: string;
  startDate: string;
  revisionId?: string | null;
  onLoaded?: (data: ScheduleLookaheadData) => void;
};

const WEEK_OPTIONS = [2, 3, 6] as const;

function downloadExport(bytes: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function labelDependency(type: string, lagDays: number): string {
  return `${type.replaceAll("_", " ")} ${lagDays >= 0 ? "+" : ""}${lagDays}d`;
}

/** Compact canonical-schedule lookahead sourced exclusively from a published revision. */
export function ScheduleLookahead({ projectId, startDate, revisionId, onLoaded }: Props) {
  const [weeks, setWeeks] = useState<2 | 3 | 6>(2);
  const [data, setData] = useState<ScheduleLookaheadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    void apiFetch<{ data: ScheduleLookaheadData }>(
      `/api/projects/${projectId}/scheduling/reports?view=lookahead&weeks=${weeks}&start_date=${startDate}${revisionId ? `&revision_id=${revisionId}` : ""}`,
      { cache: "no-store" },
    ).then((result) => {
      if (!cancelled) {
        setData(result.data);
        onLoaded?.(result.data);
      }
    }).catch((loadError) => {
      if (!cancelled) {
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Unable to load the selected schedule lookahead.");
      }
    });
    return () => { cancelled = true; };
  }, [onLoaded, projectId, revisionId, startDate, weeks]);

  const exportLookahead = async (format: "xlsx" | "pdf") => {
    if (!data) return;
    setExporting(format);
    try {
      const filename = `schedule-lookahead-r${data.revisionNumber}-${data.window.startDate}`;
      if (format === "xlsx") {
        downloadExport(createLookaheadWorkbook(data), `${filename}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      } else {
        downloadExport(await createLookaheadPdf(data), `${filename}.pdf`, "application/pdf");
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to export the selected schedule lookahead.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <section aria-label="Schedule lookahead" className="space-y-3 border-y py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Construction lookahead</p>
          <p className="text-xs text-muted-foreground">
            {data ? `Published revision ${data.revisionNumber} · ${data.window.startDate} to ${data.window.endDate}` : "Published revision required"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1" aria-label="Lookahead duration">
          {WEEK_OPTIONS.map((option) => (
            <Button key={option} type="button" size="sm" variant={weeks === option ? "secondary" : "ghost"} aria-pressed={weeks === option} onClick={() => setWeeks(option)}>
              {option} weeks
            </Button>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={!data || exporting !== null} onClick={() => void exportLookahead("xlsx")}>Export XLSX</Button>
          <Button type="button" size="sm" variant="outline" disabled={!data || exporting !== null} onClick={() => void exportLookahead("pdf")}>Export PDF</Button>
        </div>
      </div>
      {error && <InfoAlert variant="error" role="alert">{error}</InfoAlert>}
      {data?.snapshotProvenance === "reconstructed" && (
        <InfoAlert variant="warning" role="status">
          This legacy revision predates full context capture. Its calendar, deadline, and submittal context was reconstructed and may not match the original publication date.
        </InfoAlert>
      )}
      {data && data.activities.length === 0 && <p className="text-sm text-muted-foreground">No published activities fall within this selected window.</p>}
      {data?.activities.map((activity) => (
        <div key={activity.sourceTaskId} className="grid gap-1 border-t pt-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div>
            <p className="font-medium">{activity.name}</p>
            <p className="text-xs text-muted-foreground">Forecast: {activity.forecastStartDate ?? "—"} to {activity.forecastFinishDate ?? "—"}</p>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            {activity.dependencies.map((dependency) => <p key={`${dependency.predecessorSourceId}-${dependency.type}`}>{labelDependency(dependency.type, dependency.lagDays)}</p>)}
            {activity.constraint && <p>{activity.constraint.type.replaceAll("_", " ")} · {activity.constraint.date}</p>}
            {activity.submittalRisk.status === "at_risk" && <p className="text-destructive">{activity.submittalRisk.reason}</p>}
          </div>
        </div>
      ))}
    </section>
  );
}
