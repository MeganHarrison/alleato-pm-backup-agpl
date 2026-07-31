"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InfoAlert } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import type { ScheduleRiskSummary as ScheduleRiskSummaryData } from "@/lib/scheduling/schedule-risk-summary";

type Props = { projectId: string; revisionId?: string | null };

/** A quiet, source-linked decision surface backed only by the published revision. */
export function ScheduleRiskSummary({ projectId, revisionId }: Props) {
  const [data, setData] = useState<ScheduleRiskSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void apiFetch<{ data: ScheduleRiskSummaryData }>(`/api/projects/${projectId}/scheduling/reports?view=risk`, { cache: "no-store" })
      .then((result) => { if (!cancelled) setData(result.data); })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load schedule risks."); });
    return () => { cancelled = true; };
  }, [projectId, revisionId]);

  if (error) return <InfoAlert variant="error" role="alert">Schedule risks unavailable: {error}</InfoAlert>;
  if (data?.state === "unavailable") return <InfoAlert variant="warning" role="status">Schedule risks unavailable: {data.reason}</InfoAlert>;
  if (!data) return null;

  return (
    <section aria-label="Schedule risks" className="space-y-2 border-y py-4">
      <div className="flex items-baseline justify-between gap-3">
        <SectionRuleHeading as="h2" label="Schedule risks" className="mb-0 pb-0" />
        <p className="text-xs text-muted-foreground">Published revision {data.revisionNumber}</p>
      </div>
      {data.risks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No material risks are detected in the published revision.</p>
      ) : (
        <div className="divide-y">
          {data.risks.map((risk) => (
            <div key={risk.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
              <p>{risk.summary}</p>
              <Link href={risk.source.href} className="shrink-0 text-muted-foreground underline-offset-4 hover:underline">
                {risk.source.label}
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
