import Link from "next/link";
import { ArrowRightIcon, GitBranchIcon } from "lucide-react";

import {
  InspectorRail,
  InspectorSection,
  PropertyList,
  PropertyRow,
  ToneDot,
} from "@/components/ds";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scoreFeatureRequestReadiness } from "@/lib/feature-requests/readiness";
import type { FeatureRequestDetail as FeatureRequestDetailData } from "@/lib/feature-requests/types";
import { RequestTimeline } from "./RequestTimeline";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return "Not set";
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not tracked";
  return new Date(value).toLocaleString();
}

function firstSentence(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  const sentenceEnd = normalized.search(/[.!?]\s/);
  if (sentenceEnd === -1) return normalized;
  return normalized.slice(0, sentenceEnd + 1);
}

function statusTone(value: string | null | undefined): "success" | "warning" | "danger" | "info" | "neutral" {
  const normalized = value?.toLowerCase().replaceAll("_", " ") ?? "";
  if (["ready for build", "accepted", "synced", "created", "complete"].includes(normalized)) return "success";
  if (["blocked", "failed", "rejected"].includes(normalized)) return "danger";
  if (["almost ready", "ready for planning", "plan generated", "linear drafted", "in progress"].includes(normalized)) {
    return "warning";
  }
  if (["captured", "not started", "drafted"].includes(normalized)) return "info";
  return "neutral";
}

function StatusToken({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const label = formatLabel(value);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2 text-sm text-foreground", className)}>
      <ToneDot tone={statusTone(label)} />
      <span className="truncate">{label}</span>
    </span>
  );
}

function HeaderChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 max-w-full items-center gap-2 rounded-full border border-border/60 px-2.5 text-sm text-foreground">
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="heading"
      aria-level={2}
      className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
    >
      {children}
    </div>
  );
}

function TextBlock({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-3xl whitespace-pre-wrap text-sm leading-7",
        muted ? "text-muted-foreground" : "text-foreground",
      )}
    >
      {children}
    </div>
  );
}

function BulletList({ values, empty }: { values: string[]; empty: string }) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2 text-sm leading-6 text-foreground">
      {values.map((value) => (
        <li key={value} className="flex gap-2">
          <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span>{value}</span>
        </li>
      ))}
    </ul>
  );
}

function PacketSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-t border-border/50 py-3" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-muted-foreground group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="pt-3 pl-5">{children}</div>
    </details>
  );
}

function ReadinessCallout({
  readyForBuild,
  nextAction,
  missingRequirements,
}: {
  readyForBuild: boolean;
  nextAction: string;
  missingRequirements: string[];
}) {
  return (
    <section className="rounded-md border border-border bg-muted/40 px-4 py-4">
      <div className="space-y-3">
        <SectionLabel>Readiness</SectionLabel>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          <span className="font-medium text-foreground">
            {readyForBuild ? "Ready for build." : "Not ready for build."}
          </span>{" "}
          {readyForBuild ? "No required planning fields are missing." : nextAction}
        </p>
        {missingRequirements.length > 0 ? (
          <BulletList values={missingRequirements} empty="No missing requirements." />
        ) : null}
      </div>
    </section>
  );
}

export function FeatureRequestDetail({ detail }: { detail: FeatureRequestDetailData }) {
  const { request, latestPlan, handoffs, events, linearEvents, linearSubIssues } = detail;
  const readiness = scoreFeatureRequestReadiness({ request, latestPlan });
  const acceptanceCriteria = asStringArray(request.acceptance_criteria);
  const verificationSteps = asStringArray(request.verification_steps);
  const openQuestions = asStringArray(request.open_questions);
  const assumptions = asStringArray(request.assumptions);
  const affectedPages = asStringArray(request.affected_pages);
  const affectedWorkflows = asStringArray(request.affected_workflows);
  const implementationSteps = asStringArray(latestPlan?.implementation_steps);
  const missingRequirements = readiness.missingRequirements;
  const summary = "Add a short summary...";
  const description = firstSentence(request.desired_outcome) || firstSentence(request.raw_request) || summary;
  const nextAction = readiness.readyForBuild
    ? "Create or update the Linear implementation issue."
    : openQuestions[0] ?? `Resolve missing ${missingRequirements[0] ?? "planning detail"}.`;
  const combinedEvents = [
    ...linearEvents.map((event) => ({
      id: event.id,
      feature_request_id: event.feature_request_id,
      event_type: event.event_type,
      title: event.title,
      body: event.body,
      metadata: event.metadata,
      created_by: event.created_by,
      created_at: event.created_at,
    })),
    ...events,
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const issueRows =
    linearSubIssues.length > 0
      ? linearSubIssues.map((issue, index) => ({
          id: issue.id,
          key: issue.linear_issue_id ?? `FR-${index + 1}`,
          title: issue.title,
          detail: issue.source_step,
          status: issue.status,
          href: issue.linear_issue_url,
        }))
      : implementationSteps.slice(0, 5).map((step, index) => ({
          id: `step-${index}`,
          key: `FR-${index + 1}`,
          title: step,
          detail: null,
          status: "draft",
          href: null,
        }));

  return (
    <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_352px]">
      <main className="min-w-0 space-y-8">
        <div className="space-y-5">
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">{summary}</p>

          <div className="flex flex-wrap items-center gap-2">
            <HeaderChip>
              <StatusToken value={request.status} />
            </HeaderChip>
            <HeaderChip>
              <StatusToken value={readiness.label} />
            </HeaderChip>
            <HeaderChip>{formatLabel(request.priority)} priority</HeaderChip>
            <HeaderChip>{request.requester_name}</HeaderChip>
            <HeaderChip>{formatLabel(request.request_type)}</HeaderChip>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="flex min-h-12 w-full items-center justify-center rounded-md border border-border/60 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
        >
          Write project update
        </Button>

        <ReadinessCallout
          readyForBuild={readiness.readyForBuild}
          nextAction={nextAction}
          missingRequirements={missingRequirements}
        />

        <section className="space-y-3">
          <SectionLabel>Description</SectionLabel>
          <TextBlock muted>{description}</TextBlock>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Issues</SectionLabel>
            {request.linear_issue_url ? (
              <Link
                href={request.linear_issue_url}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Open Linear
                <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>

          <div className="divide-y divide-border/50">
            {issueRows.length > 0 ? (
              issueRows.map((issue) => (
                <div
                  key={issue.id}
                  className="grid grid-cols-1 gap-2 py-3 md:grid-cols-[6rem_minmax(0,1fr)_8rem] md:items-center md:gap-4"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranchIcon className="h-4 w-4" aria-hidden="true" />
                    <span>{issue.key}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{issue.title}</div>
                    {issue.detail ? (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{issue.detail}</p>
                    ) : null}
                  </div>
                  <div className="md:justify-self-end">
                    <StatusToken value={issue.status} className="text-sm" />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-3 text-sm text-muted-foreground">
                No implementation issues yet. {nextAction}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>Stakeholder Summary</SectionLabel>
          <TextBlock>{request.assistant_summary}</TextBlock>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <SectionLabel>Acceptance Criteria</SectionLabel>
            <BulletList values={acceptanceCriteria} empty="No acceptance criteria captured yet." />
          </div>
          <div className="space-y-3">
            <SectionLabel>Verification Steps</SectionLabel>
            <BulletList values={verificationSteps} empty="No verification steps captured yet." />
          </div>
        </section>

        {(openQuestions.length > 0 || assumptions.length > 0) ? (
          <section className="grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <SectionLabel>Open Questions</SectionLabel>
            <BulletList values={openQuestions} empty="No open implementation-critical questions." />
            </div>
            <div className="space-y-3">
              <SectionLabel>Assumptions</SectionLabel>
              <BulletList values={assumptions} empty="No assumptions recorded yet." />
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <SectionLabel>Original Request</SectionLabel>
          <blockquote className="max-w-3xl border-l border-border pl-4 text-sm leading-7 text-muted-foreground">
            {request.raw_request}
          </blockquote>
        </section>

        <section className="space-y-1">
          <PacketSection title="Decision Needed">
            <TextBlock muted>{nextAction}</TextBlock>
          </PacketSection>

          <PacketSection title="Implementation Plan">
            <div className="space-y-4">
              {latestPlan?.summary ? <TextBlock>{latestPlan.summary}</TextBlock> : null}
              <BulletList values={implementationSteps} empty="No implementation steps captured." />
            </div>
          </PacketSection>

          <PacketSection title="Linear Draft">
            {request.linear_draft_body ? (
              <TextBlock muted>{request.linear_draft_body}</TextBlock>
            ) : (
              <p className="text-sm text-muted-foreground">No Linear draft attached yet.</p>
            )}
          </PacketSection>

          <PacketSection title="Activity">
            {combinedEvents.length > 0 ? (
              <RequestTimeline events={combinedEvents} />
            ) : (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            )}
          </PacketSection>
        </section>
      </main>

      <InspectorRail className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <InspectorSection title="Properties" variant="plain">
          <PropertyList className="divide-y-0">
            <PropertyRow label="Status">
              <StatusToken value={request.status} />
            </PropertyRow>
            <PropertyRow label="Priority">{formatLabel(request.priority)}</PropertyRow>
            <PropertyRow label="Requester">{request.requester_name}</PropertyRow>
            <PropertyRow label="Type">{formatLabel(request.request_type)}</PropertyRow>
            <PropertyRow label="Source">{formatLabel(request.source)}</PropertyRow>
            <PropertyRow label="Project">{request.project_id ? String(request.project_id) : null}</PropertyRow>
            <PropertyRow label="Linear sync">
              <StatusToken value={request.linear_sync_status} />
            </PropertyRow>
          </PropertyList>
        </InspectorSection>

        <InspectorSection title="Milestones" variant="plain" defaultOpen={false}>
          <p className="text-sm text-muted-foreground">No milestones created yet.</p>
        </InspectorSection>

        <InspectorSection title="Progress" variant="plain" defaultOpen={false}>
          <PropertyList className="divide-y-0">
            <PropertyRow label="Scope">{issueRows.length}</PropertyRow>
            <PropertyRow label="Completed">
              {issueRows.filter((issue) => ["synced", "complete"].includes(issue.status ?? "")).length}
            </PropertyRow>
            <PropertyRow label="Missing">
              {missingRequirements.length > 0 ? missingRequirements.length : "None"}
            </PropertyRow>
          </PropertyList>
        </InspectorSection>

        <InspectorSection title="Readiness" variant="plain" defaultOpen={false}>
          <PropertyList className="divide-y-0">
            <PropertyRow label="Goal">{formatLabel(readiness.goalClarity)}</PropertyRow>
            <PropertyRow label="Data">{formatLabel(readiness.dataClarity)}</PropertyRow>
            <PropertyRow label="UX">{formatLabel(readiness.uxClarity)}</PropertyRow>
            <PropertyRow label="Criteria">{formatLabel(readiness.acceptanceStatus)}</PropertyRow>
            <PropertyRow label="Risk">{formatLabel(readiness.implementationRisk)}</PropertyRow>
          </PropertyList>
        </InspectorSection>

        {(affectedPages.length > 0 || affectedWorkflows.length > 0 || request.desired_outcome) ? (
          <InspectorSection title="Scope" variant="plain" defaultOpen={false}>
            <PropertyList className="divide-y-0">
              <PropertyRow label="Pages">
                {affectedPages.length > 0 ? affectedPages.join(", ") : null}
              </PropertyRow>
              <PropertyRow label="Workflows">
                {affectedWorkflows.length > 0 ? affectedWorkflows.join(", ") : null}
              </PropertyRow>
              <PropertyRow label="Outcome">{request.desired_outcome}</PropertyRow>
            </PropertyList>
          </InspectorSection>
        ) : null}

        <InspectorSection title="Activity" variant="plain" defaultOpen={false}>
          {combinedEvents.length > 0 ? (
            <RequestTimeline events={combinedEvents.slice(0, 3)} />
          ) : (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </InspectorSection>

        <InspectorSection title="Trace" variant="plain" defaultOpen={false}>
          <PropertyList className="divide-y-0">
            <PropertyRow label="Created">{formatDate(request.created_at)}</PropertyRow>
            <PropertyRow label="Updated">{formatDate(request.updated_at)}</PropertyRow>
            <PropertyRow label="Request ID">
              <span className="break-all text-xs text-muted-foreground">{request.id}</span>
            </PropertyRow>
            <PropertyRow label="Handoff">
              {handoffs[0]?.handoff_path ?? request.claude_handoff_path ?? "Not generated"}
            </PropertyRow>
          </PropertyList>
        </InspectorSection>
      </InspectorRail>
    </div>
  );
}
