"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { InfoAlert } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";

type TradeScheduleActivity = {
  sourceTaskId: string;
  name: string;
  assigneePersonId: string | null;
};

type TradeActivitiesResponse = {
  revisionId: string;
  data: TradeScheduleActivity[];
};

type Props = { projectId: string; revisionId?: string | null };

/**
 * The canonical Schedule page's narrow read surface for a trade member. The API
 * is the authorization boundary and returns only published snapshots assigned
 * to the current membership; this component never fetches broad live tasks.
 */
export function TradeScheduleActivities({ projectId, revisionId }: Props) {
  const [data, setData] = useState<TradeActivitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    void apiFetch<TradeActivitiesResponse>(`/api/projects/${projectId}/scheduling/reports?view=trade-activities`, { cache: "no-store" })
      .then((result) => { if (!cancelled) setData(result); })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load assigned activities.");
      });
    return () => { cancelled = true; };
  }, [projectId, revisionId]);

  if (error) return <InfoAlert variant="error" role="alert">Assigned activities unavailable: {error}</InfoAlert>;
  if (!data || data.data.length === 0) return null;

  return (
    <section aria-label="My assigned schedule activities" className="space-y-2 border-y py-4">
      <div className="flex items-baseline justify-between gap-3">
        <SectionRuleHeading label="My assigned activities" className="mb-0 pb-0" />
        <p className="text-xs text-muted-foreground">Published schedule</p>
      </div>
      <div className="divide-y">
        {data.data.map((activity) => (
          <Link
            key={activity.sourceTaskId}
            href={`/${projectId}/schedule?task_id=${encodeURIComponent(activity.sourceTaskId)}`}
            className="block py-2 text-sm underline-offset-4 hover:underline"
          >
            {activity.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
