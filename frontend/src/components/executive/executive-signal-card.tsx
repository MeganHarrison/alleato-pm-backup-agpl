"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarDays, ChevronDown, Eye, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { AiFeedbackControl } from "@/components/ai/ai-feedback-control";
import {
  ExecutiveProjectLinkForm,
  type ExecutiveProjectOption,
} from "@/components/executive/executive-project-link-form";
import {
  ExecutiveTaskDraftForm,
  type ExecutiveTaskAssigneeOption,
} from "@/components/executive/executive-task-draft-form";
import { ExecutiveRelatedTaskTable } from "@/components/executive/executive-related-task-table";
import type { BrandonBriefItem } from "@/lib/executive/brandon-daily-update";
import { getExecutiveBriefBullets } from "@/lib/executive/executive-brief-bullets";
import { resolveExecutiveFollowUpAction } from "@/app/(main)/actions/executive-briefing-actions";

export type ExecutiveRelatedTask = {
  id: string;
  title: string | null;
  description: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneePersonId: string | null;
  metadataId: string;
  projectName: string | null;
};

function displayProjectLabel(value: string) {
  const label = value.replace(/\s+/g, " ").trim() || "No project linked";
  return label.replace(/^\d{2,5}\s*[-:]?\s+/, "").trim() || label;
}

function DetailBlock({
  label,
  children,
  stacked = false,
}: {
  label: string;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 border-t border-border/60 py-4 first:border-t-0 first:pt-0",
        !stacked && "md:grid-cols-[132px_1fr]",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 text-sm leading-6 text-foreground">
        {children}
      </div>
    </div>
  );
}

export function ExecutiveSignalCard({
  item,
  employees,
  hasMatchingTask,
  relatedTasks,
  followUpId,
  actionLabel,
  projectHref,
  currentProjectId,
  projects,
  defaultOpen = false,
}: {
  item: BrandonBriefItem;
  employees: ExecutiveTaskAssigneeOption[];
  hasMatchingTask: boolean;
  relatedTasks: ExecutiveRelatedTask[];
  followUpId?: string;
  actionLabel?: string;
  projectHref?: string | null;
  currentProjectId?: number | null;
  projects: ExecutiveProjectOption[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [rawEvidenceOpen, setRawEvidenceOpen] = useState(false);
  const [isResolving, startResolveTransition] = useTransition();
  const router = useRouter();
  const primaryEvidence = item.evidence ?? item.citations[0]?.evidence;
  const evidenceCitations = item.citations.filter((citation) =>
    citation.evidence?.trim(),
  );
  const packetEvidenceFacts = item.evidenceFacts?.filter(Boolean) ?? [];
  const evidenceFacts =
    packetEvidenceFacts.length > 0
      ? packetEvidenceFacts
      : item.bullets.filter(Boolean).slice(0, 6);
  const citationCount = item.citations.length;
  const projectLabel = displayProjectLabel(item.project);
  const sourceUrl = item.sourceUrl ?? item.citations[0]?.sourceUrl;
  const sourceLabel = item.sourceDetail?.trim() || item.title;
  const sourceMeta = `${sourceLabel} - ${item.date}`;
  const executiveBullets = getExecutiveBriefBullets(item);
  const hasRawEvidence = Boolean(
    primaryEvidence || evidenceCitations.length > 0,
  );
  const resolveFollowUp = () => {
    if (!followUpId) return;
    const formData = new FormData();
    formData.set("followUpId", followUpId);
    startResolveTransition(async () => {
      await resolveExecutiveFollowUpAction(formData);
      router.refresh();
    });
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="bg-background"
    >
      <div className="flex w-full items-start gap-4 py-5">
        <div className="min-w-0 flex-1 space-y-2">
          <CollapsibleTrigger className="block w-full text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="space-y-2">
              <div className="text-base font-semibold leading-snug text-foreground">
                {item.title}
              </div>

              <ol className="max-w-3xl list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
                {executiveBullets.map((bullet) => (
                  <li key={bullet} className="pl-1">
                    {bullet}
                  </li>
                ))}
              </ol>
            </div>
          </CollapsibleTrigger>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs font-medium text-muted-foreground">
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 border-b border-border pb-0.5 transition-colors hover:border-foreground hover:text-foreground"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {sourceMeta}
              </a>
            ) : (
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                {sourceMeta}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" />
              {citationCount} source{citationCount === 1 ? "" : "s"}
            </span>
            {actionLabel && <span>{actionLabel}</span>}
            {relatedTasks.length > 0 && (
              <span>
                {relatedTasks.length} related task
                {relatedTasks.length === 1 ? "" : "s"}
              </span>
            )}
            {hasRawEvidence && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                aria-label={
                  rawEvidenceOpen ? "Hide raw evidence" : "Show raw evidence"
                }
                title={
                  rawEvidenceOpen ? "Hide raw evidence" : "Show raw evidence"
                }
                onClick={() => setRawEvidenceOpen((nextOpen) => !nextOpen)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}
            <AiFeedbackControl
              className="ml-auto"
              surface="daily_brief"
              subjectType="brief_item"
              subjectId={followUpId ?? null}
              projectId={currentProjectId ?? null}
              contentText={[item.title, ...executiveBullets].join(" ")}
            />
          </div>

          {rawEvidenceOpen && hasRawEvidence && (
            <div className="max-w-3xl space-y-4 pt-2 text-sm leading-6 text-muted-foreground">
              {evidenceCitations.length > 0 ? (
                evidenceCitations.map((citation, index) => (
                  <div
                    key={`${citation.source}-${citation.sourceId ?? citation.sourceDetail}-${index}`}
                    className="space-y-2"
                  >
                    {citationCount > 1 && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {citation.source}
                        </span>
                        <span>{citation.sourceDetail}</span>
                        <span>{citation.date}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{citation.evidence}</p>
                  </div>
                ))
              ) : (
                <p className="whitespace-pre-wrap">{primaryEvidence}</p>
              )}
            </div>
          )}
        </div>

        <CollapsibleTrigger className="flex shrink-0 items-center gap-2 pt-0.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <span>{open ? "Hide details" : "Show details"}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="pb-6">
          <div className="border-t border-border/60 pt-4">
            <DetailBlock label="Project">
              {item.sourceId ? (
                <ExecutiveProjectLinkForm
                  sourceId={item.sourceId}
                  projects={projects}
                  currentProjectId={currentProjectId}
                  label={projectLabel}
                />
              ) : projectHref ? (
                <a
                  href={projectHref}
                  className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  {projectLabel}
                </a>
              ) : (
                <>
                  <span className="font-medium text-foreground">
                    {projectLabel}
                  </span>
                </>
              )}
            </DetailBlock>

            {item.recommendedAction && (
              <DetailBlock label="Next move">
                {item.recommendedAction}
              </DetailBlock>
            )}

            {evidenceFacts.length > 0 && (
              <DetailBlock label="Evidence">
                <ul className="space-y-2">
                  {evidenceFacts.map((fact) => (
                    <li key={fact} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </DetailBlock>
            )}

            <DetailBlock label="Tasks" stacked>
              <div className="space-y-4">
                {relatedTasks.length > 0 && (
                  <ExecutiveRelatedTaskTable
                    tasks={relatedTasks}
                    employees={employees}
                  />
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {followUpId && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 px-4 text-xs font-medium"
                      disabled={isResolving}
                      onClick={resolveFollowUp}
                    >
                      {isResolving ? "Resolving..." : "Mark resolved"}
                    </Button>
                  )}

                  {!hasMatchingTask && (
                    <ExecutiveTaskDraftForm
                      sourceId={item.sourceId}
                      title={item.title}
                      description={item.recommendedAction ?? item.summary}
                      employees={employees}
                      hasMatchingTask={false}
                    />
                  )}
                </div>
              </div>
            </DetailBlock>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
