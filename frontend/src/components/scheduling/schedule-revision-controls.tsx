"use client";

import { Button } from "@/components/ui/button";
import type { ScheduleBaseline } from "@/lib/scheduling/schedule-baselines";
import { ScheduleBaselineDialog } from "./schedule-baseline-dialog";

export type ScheduleRevisionControlItem = {
  id: string;
  revision_number: number;
  status: "draft" | "review" | "published" | "superseded";
  published_at: string | null;
};

type Props = {
  revisions: ScheduleRevisionControlItem[];
  baselines?: ScheduleBaseline[];
  canManageBaselines?: boolean;
  canManageSchedule?: boolean;
  onSnapshot: () => void;
  onTransition: (revisionId: string, status: "review" | "published") => void;
  onCaptureBaseline?: (input: { name: string; revisionId: string; activate: boolean }) => void | Promise<void>;
  onActivateBaseline?: (baselineId: string) => void | Promise<void>;
  disabled?: boolean;
};

/** A compact canonical-schedule control, intentionally not a parallel revision page. */
export function ScheduleRevisionControls({
  revisions,
  baselines = [],
  canManageBaselines = false,
  canManageSchedule = false,
  onSnapshot,
  onTransition,
  onCaptureBaseline = () => undefined,
  onActivateBaseline = () => undefined,
  disabled = false,
}: Props) {
  const current = revisions.find((revision) => revision.status === "published") ?? null;
  const activeBaseline = baselines.find((baseline) => baseline.is_active) ?? null;
  return (
    <section aria-label="Schedule revisions" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{current ? `Published revision ${current.revision_number}` : "No published revision"}</p>
          <p className="text-xs text-muted-foreground">{activeBaseline ? `Active baseline: ${activeBaseline.name}` : "No active baseline"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ScheduleBaselineDialog
            baselines={baselines}
            revisions={revisions}
            canManage={canManageBaselines}
            disabled={disabled}
            onCapture={onCaptureBaseline}
            onActivate={onActivateBaseline}
          />
          <Button type="button" variant="outline" size="sm" onClick={onSnapshot} disabled={disabled}>Snapshot schedule</Button>
        </div>
      </div>
      {revisions.length > 0 && (
        <details className="border-y py-2 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Revision history</summary>
          <div className="mt-2 divide-y">
            {revisions.map((revision) => (
              <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">Revision {revision.revision_number}</span>
                  <span className="ml-2 text-muted-foreground">{revision.status}</span>
                </div>
                {canManageSchedule && revision.status === "draft" && <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onTransition(revision.id, "review")}>Request review</Button>}
                {canManageSchedule && revision.status === "review" && <Button type="button" size="sm" disabled={disabled} onClick={() => onTransition(revision.id, "published")}>Publish revision</Button>}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
