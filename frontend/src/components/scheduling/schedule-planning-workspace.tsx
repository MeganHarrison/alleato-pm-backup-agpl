"use client";

import type { ReactNode } from "react";
import { InfoAlert } from "@/components/ds";
import { PageTabs, SectionRuleHeading } from "@/components/layout";
import type {
  ScheduleBaseline,
  ScheduleBaselineComparison,
} from "@/lib/scheduling/schedule-baselines";
import { ScheduleLookahead } from "./schedule-lookahead";
import {
  ScheduleRevisionControls,
  type ScheduleRevisionControlItem,
} from "./schedule-revision-controls";
import { ScheduleRiskSummary } from "./schedule-risk-summary";
import { TradeScheduleActivities } from "./trade-schedule-activities";

type Props = {
  projectId: string;
  revisions: ScheduleRevisionControlItem[];
  baselines: ScheduleBaseline[];
  baselineComparison?: ScheduleBaselineComparison | null;
  canManageBaselines: boolean;
  onSnapshot: () => void;
  onTransition: (revisionId: string, status: "review" | "published") => void;
  onCaptureBaseline: (input: {
    name: string;
    revisionId: string;
    activate: boolean;
  }) => void | Promise<void>;
  onActivateBaseline: (baselineId: string) => void | Promise<void>;
  disabled?: boolean;
  revisionActionError?: string | null;
  baselineActionError?: string | null;
  lookaheadStartDate: string;
  resourceAvailability: ReactNode;
};

export type ScheduleWorkspace = "schedule" | "planning";

export function getScheduleWorkspace(searchParams: {
  get(name: string): string | null;
}): ScheduleWorkspace {
  return searchParams.get("workspace") === "planning" ? "planning" : "schedule";
}

export function ScheduleWorkspaceNavigation({
  projectId,
  workspace,
}: {
  projectId: string;
  workspace: ScheduleWorkspace;
}) {
  return (
    <PageTabs
      variant="inline"
      className="mb-4"
      tabs={[
        {
          label: "Schedule",
          href: `/${projectId}/schedule`,
          isActive: workspace === "schedule",
          testId: "schedule-workspace-tab",
        },
        {
          label: "Resources, costs, leveling, revisions & reports",
          href: `/${projectId}/schedule?workspace=planning`,
          isActive: workspace === "planning",
          testId: "schedule-planning-tab",
        },
      ]}
    />
  );
}

/**
 * The single owner for schedule planning, publication, resource analysis, and
 * reporting. Keeping these modules behind one component prevents the editing
 * workspace and planning workspace from silently drifting back together.
 */
export function SchedulePlanningWorkspace({
  projectId,
  revisions,
  baselines,
  baselineComparison = null,
  canManageBaselines,
  onSnapshot,
  onTransition,
  onCaptureBaseline,
  onActivateBaseline,
  disabled = false,
  revisionActionError = null,
  baselineActionError = null,
  lookaheadStartDate,
  resourceAvailability,
}: Props) {
  const tasks = baselineComparison?.tasks ?? [];
  const baselineChangeSummary = {
    changed: tasks.filter((task) => task.comparison_status === "changed")
      .length,
    added: tasks.filter((task) => task.comparison_status === "added"),
    removed: tasks.filter((task) => task.comparison_status === "removed"),
  };
  const publishedRevisionId =
    revisions.find((revision) => revision.status === "published")?.id ?? null;

  return (
    <section aria-label="Schedule planning controls" className="space-y-6 pb-6">
      <header className="border-b pb-4">
        <SectionRuleHeading
          as="h2"
          label="Resources, costs, publishing, and reports"
          className="mb-2"
        />
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Review resource capacity, equipment and material rates, earned value,
          schedule revisions, baselines, and traceable project reports.
        </p>
      </header>

      {!publishedRevisionId && (
        <InfoAlert variant="info" role="status">
          Start here: review resource and cost facts below. Snapshot the current
          schedule, open Revision history, select Request review, then Publish
          revision. Publishing activates lookahead, risk, and trade reports.
        </InfoAlert>
      )}

      {revisionActionError && (
        <InfoAlert variant="error" role="alert">
          {revisionActionError}
        </InfoAlert>
      )}
      {baselineActionError && (
        <InfoAlert variant="error" role="alert">
          Baseline comparison unavailable: {baselineActionError}
        </InfoAlert>
      )}
      {baselineComparison?.provenance === "reconstructed" && (
        <InfoAlert variant="warning" role="status">
          This legacy baseline predates full context capture. Calendar,
          deadline, and submittal context was reconstructed and may not match
          the original publication date.
        </InfoAlert>
      )}

      {resourceAvailability}

      <ScheduleRevisionControls
        revisions={revisions}
        baselines={baselines}
        canManageBaselines={canManageBaselines}
        canManageSchedule={canManageBaselines}
        onSnapshot={onSnapshot}
        onTransition={onTransition}
        onCaptureBaseline={onCaptureBaseline}
        onActivateBaseline={onActivateBaseline}
        disabled={disabled}
      />

      {baselineComparison && (
        <section
          aria-label="Baseline variance summary"
          className="border-y py-3 text-sm"
        >
          <p className="text-muted-foreground">
            Baseline changes: {baselineChangeSummary.changed} changed ·{" "}
            {baselineChangeSummary.added.length} added ·{" "}
            {baselineChangeSummary.removed.length} removed
          </p>
          {(baselineChangeSummary.added.length > 0 ||
            baselineChangeSummary.removed.length > 0) && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">
                Scope changes
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {baselineChangeSummary.added.map((task) => (
                  <li key={`added-${task.source_task_id}`}>
                    {task.name} — added
                  </li>
                ))}
                {baselineChangeSummary.removed.map((task) => (
                  <li key={`removed-${task.source_task_id}`}>
                    {task.name} — removed
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <ScheduleLookahead
        projectId={projectId}
        startDate={lookaheadStartDate}
        revisionId={publishedRevisionId}
      />
      <ScheduleRiskSummary
        projectId={projectId}
        revisionId={publishedRevisionId}
      />
      <TradeScheduleActivities
        projectId={projectId}
        revisionId={publishedRevisionId}
      />
    </section>
  );
}
