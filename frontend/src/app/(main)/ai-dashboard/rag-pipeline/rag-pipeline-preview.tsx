"use client";

import { Heading } from "@/components/ds";
import { BarChart } from "@/components/ui/charts";
import {
  formatDateTime,
  sourceError,
  useDocumentLifecycle,
} from "../live-data";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
  WorkspaceSourceState,
} from "../workspace-primitives";

const lifecycleOrder = [
  "Synced",
  "Processing",
  "Vectorized",
  "Project assigned",
  "Tasks extracted",
  "Failed",
  "Unknown",
];

export const RECOVERY_ERROR_MAX_LENGTH = 160;

export function formatRecoveryError(errorMessage: string | null): string {
  const message =
    errorMessage ||
    "The ingestion job reported a failed lifecycle state without an error message.";

  if (message.length <= RECOVERY_ERROR_MAX_LENGTH) return message;

  return `${message.slice(0, RECOVERY_ERROR_MAX_LENGTH - 1).trimEnd()}…`;
}

export function RagPipelinePreview() {
  const lifecycle = useDocumentLifecycle();
  const counts = new Map<string, number>();
  for (const document of lifecycle.data?.documents ?? []) {
    counts.set(document.lifecycle_label, (counts.get(document.lifecycle_label) ?? 0) + 1);
  }
  const chartData = lifecycleOrder
    .filter((label) => counts.has(label))
    .map((label) => ({ date: label, Documents: counts.get(label) ?? 0 }));
  const failed = (lifecycle.data?.documents ?? []).filter(
    (document) => document.lifecycle_label === "Failed",
  );
  const latestTimestamp = (lifecycle.data?.documents ?? [])
    .map((document) => document.created_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <>
      <WorkspacePageIntro
        eyebrow="RAG Pipeline"
        title={
          lifecycle.data
            ? `${lifecycle.data.total.toLocaleString()} Fireflies meeting source records are tracked.`
            : "Loading the current intelligence pipeline."
        }
        statusLabel={
          latestTimestamp
            ? `Latest record ${formatDateTime(latestTimestamp)}`
            : "Live document lifecycle"
        }
      >
        The lifecycle chart groups the {lifecycle.data?.documents.length ?? 0} most
        recent records returned by the source. Counts come from synced documents
        and their ingestion jobs; failed records remain visible so pipeline
        health cannot be overstated.
      </WorkspacePageIntro>

      <WorkspaceSection
        eyebrow="Lifecycle"
        title="Current records by processing outcome"
        className="mt-10 pt-0"
        showTopDivider={false}
        action={<CanonicalLink href="/pipeline">Open pipeline operations</CanonicalLink>}
      >
        {lifecycle.isLoading ? (
          <WorkspaceSourceState source="Fireflies lifecycle" state="loading" />
        ) : lifecycle.isError ? (
          <WorkspaceSourceState
            source="Fireflies lifecycle"
            state="error"
            detail={sourceError(lifecycle.error, "Fireflies lifecycle")}
          />
        ) : chartData.length > 0 ? (
          <div className="rounded-xl bg-card p-5 sm:p-6">
            <BarChart
              data={chartData}
              categories={["Documents"]}
              colors={["primary"]}
              yAxisWidth={38}
              height="300px"
            />
          </div>
        ) : (
          <WorkspaceSourceState source="Fireflies lifecycle" state="empty" />
        )}
      </WorkspaceSection>

      <WorkspaceSection
        eyebrow="Source detail"
        title="What the lifecycle currently contains"
        className="mt-12"
      >
        {lifecycle.data ? (
          <div className="divide-y divide-border">
            {lifecycleOrder
              .filter((label) => counts.has(label))
              .map((label, index) => (
                <div
                  key={label}
                  className="grid gap-3 py-5 sm:grid-cols-[3rem_minmax(10rem,0.55fr)_minmax(0,1.5fr)_6rem] sm:items-start"
                >
                  <span className="font-mono text-xs text-muted-foreground/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Heading level={6} as="h2" className="text-sm font-medium text-foreground">
                    {label}
                  </Heading>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {lifecycleDescription(label)}
                  </p>
                  <span className={label === "Failed" ? "text-sm font-medium text-destructive sm:text-right" : "text-sm font-medium text-primary sm:text-right"}>
                    {counts.get(label)}
                  </span>
                </div>
              ))}
          </div>
        ) : null}
      </WorkspaceSection>

      {failed.length > 0 ? (
        <WorkspaceSection
          eyebrow="Recovery"
          title="Failed records that need pipeline review"
          className="mt-12"
        >
          <div className="divide-y divide-border">
            {failed.slice(0, 8).map((document) => (
              <article key={document.id} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1.5fr)_7rem] sm:items-start">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {document.title || "Untitled meeting"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {document.project_name || "Project not assigned"}
                  </p>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {formatRecoveryError(document.error_message)}
                </p>
                <p className="text-xs text-muted-foreground sm:text-right">
                  {formatDateTime(document.created_at)}
                </p>
              </article>
            ))}
          </div>
        </WorkspaceSection>
      ) : null}
    </>
  );
}

function lifecycleDescription(label: string) {
  switch (label) {
    case "Synced":
      return "The source record is present and waiting for downstream processing.";
    case "Processing":
      return "Segmentation, chunking, embedding, or structured extraction is in progress.";
    case "Vectorized":
      return "The record completed ingestion and is available to retrieval.";
    case "Project assigned":
      return "The completed record is connected to a project operating context.";
    case "Tasks extracted":
      return "The meeting produced one or more persisted task records.";
    case "Failed":
      return "The ingestion job recorded an error and needs explicit recovery.";
    default:
      return "The source exists without a recognized lifecycle state.";
  }
}
