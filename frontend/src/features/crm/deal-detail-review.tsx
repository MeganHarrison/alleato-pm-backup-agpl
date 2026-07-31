"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  DetailField,
  DetailFieldGrid,
  EditableDetailField,
  EmptyState,
  StatusBadge,
} from "@/components/ds";
import {
  ContentSectionStack,
  DetailLayout,
  DetailPanel,
  PageShell,
  SectionRuleHeading,
} from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCrmWorkspace } from "@/hooks/use-crm";
import { CRM_PURSUIT_PLAYBOOK } from "@/lib/crm/playbooks";
import type { CrmActivity } from "@/lib/crm/types";
import { buildCrmWorkspaceTabs } from "@/features/crm/crm-workspace-tabs";

export function CrmDealDetailReview({ dealId }: { dealId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    deals,
    stages,
    dealStageEvents,
    activities: allActivities,
    followUps: allFollowUps,
    attachments,
    updateDeal,
    moveDeal,
    convertDeal,
    addAttachment,
    removeAttachment,
    addFollowUp,
    addActivity,
    updateFollowUpStatus,
    startPursuitPlaybook,
    archivedDealIds,
    archiveDeal,
    restoreDeal,
    severProjectLink,
  } = useCrmWorkspace();
  const [attachmentName, setAttachmentName] = React.useState("");
  const [followUpTitle, setFollowUpTitle] = React.useState("");
  const [followUpDueDate, setFollowUpDueDate] = React.useState("");
  const [actionReason, setActionReason] = React.useState("");
  const [activityType, setActivityType] =
    React.useState<CrmActivity["activityType"]>("call");
  const [activitySubject, setActivitySubject] = React.useState("");
  const [isStartingPlaybook, setIsStartingPlaybook] = React.useState(false);
  const deal = deals.find((candidate) => candidate.id === dealId) ?? null;

  if (!deal) {
    return (
      <PageShell
        variant="detail"
        title="Deal not found"
        onBack={() => router.push("/crm/deals")}
        tabs={buildCrmWorkspaceTabs(pathname)}
      >
        <EmptyState
          title="Deal not found"
          description="Return to the deal list and choose an available record."
        />
      </PageShell>
    );
  }

  const stage = stages.find((candidate) => candidate.id === deal.stageId);
  const activities = allActivities.filter(
    (activity) => activity.dealId === deal.id,
  );
  const followUps = allFollowUps.filter((task) => task.dealId === deal.id);
  const stageEvents = dealStageEvents.filter(
    (event) => event.dealId === deal.id,
  );
  const timeline = [
    ...activities.map((activity) => ({
      id: `activity-${activity.id}`,
      occurredAt: activity.occurredAt,
      kind: activity.activityType,
      title: activity.subject,
      detail: `${activity.createdBy} · ${activity.recordOrigin === "auto" ? "matched communication" : "manual activity"}`,
    })),
    ...followUps.map((task) => ({
      id: `task-${task.id}`,
      occurredAt: `${task.dueDate}T12:00:00.000Z`,
      kind: "task",
      title: task.title,
      detail: `${task.status.replaceAll("_", " ")} · ${task.assignee}`,
    })),
    ...stageEvents.map((event) => ({
      id: `stage-${event.id}`,
      occurredAt: event.changedAt,
      kind: "stage",
      title: event.fromStageName
        ? `${event.fromStageName} → ${event.toStageName}`
        : `Entered ${event.toStageName}`,
      detail: event.reason
        ? `${event.changedBy} · ${event.reason}`
        : event.changedBy,
    })),
  ].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
  const dealAttachments = attachments[deal.id] ?? [];
  const isArchived = archivedDealIds.includes(deal.id);
  const pursuitPlaybookStarted = CRM_PURSUIT_PLAYBOOK.some((step) =>
    followUps.some((task) => task.title === step.title),
  );
  const pursuitPlaybookComplete = CRM_PURSUIT_PLAYBOOK.every((step) =>
    followUps.some((task) => task.title === step.title),
  );

  const saveField = async (
    field: "name" | "valueEstimate" | "expectedCloseDate" | "probability",
    value: string,
  ) => {
    try {
      await updateDeal(deal.id, {
        [field]:
          field === "valueEstimate" || field === "probability"
            ? Number(value)
            : value,
      });
      toast.success("Deal saved");
    } catch (error) {
      toast.error("Deal field could not be saved", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  const moveStage = async (stageId: string) => {
    const target = stages.find((candidate) => candidate.id === stageId);
    if (!target) return;
    try {
      await moveDeal(deal.id, stageId);
      toast.success(`Moved to ${target.name}`);
    } catch (error) {
      toast.error("Deal stage could not be changed", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  const convert = async () => {
    try {
      await convertDeal(deal.id);
      toast.success("Project created; Acumatica reconciliation is queued");
    } catch (error) {
      toast.error("Conversion could not start", {
        description:
          error instanceof Error ? error.message : "Review the deal state.",
      });
    }
  };

  return (
    <PageShell
      variant="detail"
      eyebrow={deal.companyName}
      title={deal.name}
      onBack={() => router.push("/crm/deals")}
      statusBadge={<StatusBadge status={deal.status} />}
      tabs={buildCrmWorkspaceTabs(pathname)}
      actions={
        <div className="flex flex-wrap gap-2">
          {deal.projectId ? (
            <Button
              variant="outline"
              disabled={isArchived}
              onClick={async () => {
                try {
                  await severProjectLink(deal.id, actionReason);
                  setActionReason("");
                  toast.success("Project link removed");
                } catch (error) {
                  toast.error("Project link could not be removed", {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Refresh and try again.",
                  });
                }
              }}
            >
              Remove project link
            </Button>
          ) : null}
          {deal.status === "won" &&
          deal.projectId === null &&
          !deal.leadId ? (
            <Button disabled={isArchived} onClick={convert}>
              Create project
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                if (isArchived) await restoreDeal(deal.id);
                else await archiveDeal(deal.id, actionReason);
                setActionReason("");
                toast.success(isArchived ? "Deal restored" : "Deal archived");
              } catch (error) {
                toast.error(
                  isArchived
                    ? "Deal could not be restored"
                    : "Deal could not be archived",
                  {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Refresh and try again.",
                  },
                );
              }
            }}
          >
            {isArchived ? "Restore deal" : "Archive deal"}
          </Button>
        </div>
      }
    >
      <ContentSectionStack>
        <DetailLayout
          sidebar={
            <DetailPanel>
              <SectionRuleHeading label="Conversion" />
              <DetailField label="Project">
                {deal.projectId
                  ? `Project ${deal.projectId}`
                  : deal.leadId
                    ? "Link the lead to an approved company first"
                    : "Not linked"}
              </DetailField>
              <DetailField label="Project status">
                {deal.projectSyncStatus.replaceAll("_", " ")}
              </DetailField>
              <DetailField label="Concurrency version">
                {deal.rowVersion}
              </DetailField>
              <DetailField label="Change reason">
                <Input
                  value={actionReason}
                  onChange={(event) => setActionReason(event.target.value)}
                  placeholder="Required for archive or link removal"
                  disabled={isArchived}
                />
              </DetailField>
            </DetailPanel>
          }
        >
          <DetailPanel>
            <SectionRuleHeading label="Opportunity" />
            <DetailFieldGrid columns={2}>
              <EditableDetailField
                label="Name"
                disabled={isArchived}
                value={deal.name}
                onSave={(value) => saveField("name", value)}
              />
              <EditableDetailField
                label="Stage"
                disabled={isArchived}
                type="select"
                value={deal.stageId}
                display={stage?.name}
                options={stages.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                }))}
                onSave={moveStage}
              />
              <EditableDetailField
                label="Value"
                disabled={isArchived}
                type="number"
                value={String(deal.valueEstimate)}
                display={formatCurrency(deal.valueEstimate)}
                onSave={(value) => saveField("valueEstimate", value)}
              />
              <EditableDetailField
                label="Probability"
                disabled={isArchived}
                type="number"
                value={String(deal.probability)}
                display={`${deal.probability}%`}
                onSave={(value) => saveField("probability", value)}
              />
              <EditableDetailField
                label="Expected close"
                disabled={isArchived}
                type="date"
                value={deal.expectedCloseDate ?? ""}
                display={
                  deal.expectedCloseDate
                    ? formatDate(deal.expectedCloseDate)
                    : undefined
                }
                emptyPlaceholder="Set date"
                onSave={(value) => saveField("expectedCloseDate", value)}
              />
              <DetailField label="Owner">{deal.owner.name}</DetailField>
              <DetailField label="Source">{deal.source}</DetailField>
              <DetailField label="Currency">USD</DetailField>
            </DetailFieldGrid>
          </DetailPanel>
          <DetailPanel>
            <SectionRuleHeading label="Timeline" />
            <div className="mt-4 grid gap-2 sm:grid-cols-[150px_1fr_auto]">
              <Select
                value={activityType}
                onValueChange={(value) =>
                  setActivityType(value as CrmActivity["activityType"])
                }
              >
                <SelectTrigger aria-label="Quick activity type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["call", "email", "meeting", "note"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={activitySubject}
                onChange={(event) => setActivitySubject(event.target.value)}
                placeholder="Record the outcome or next decision"
                maxLength={300}
                disabled={isArchived}
              />
              <Button
                variant="outline"
                disabled={isArchived || !activitySubject.trim()}
                onClick={async () => {
                  try {
                    await addActivity({
                      companyId: deal.companyId,
                      leadId: deal.leadId,
                      companyName: deal.companyName,
                      dealId: deal.id,
                      activityType,
                      subject: activitySubject.trim(),
                      visibilityScope: "standard",
                    });
                    setActivitySubject("");
                    toast.success("Activity recorded");
                  } catch (error) {
                    toast.error("Activity could not be recorded", {
                      description:
                        error instanceof Error
                          ? error.message
                          : "Refresh and try again.",
                    });
                  }
                }}
              >
                Record
              </Button>
            </div>
            {timeline.length ? (
              <ul className="divide-y divide-border">
                {timeline.map((item) => (
                  <li
                    key={item.id}
                    className="grid gap-1 py-3 text-sm sm:grid-cols-[7rem_1fr_auto] sm:items-start sm:gap-4"
                  >
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {item.kind}
                    </span>
                    <span>
                      <span className="block font-medium">{item.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.detail}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.occurredAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No timeline activity"
                description="Record the first call, email, meeting, note, or follow-up."
              />
            )}
          </DetailPanel>
          <DetailPanel>
            <SectionRuleHeading label="Follow-ups" />
            {followUps.length ? (
              <ul className="divide-y divide-border">
                {followUps.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span>{task.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {formatDate(task.dueDate)}
                      </span>
                      {task.status !== "done" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isArchived}
                          onClick={async () => {
                            try {
                              await updateFollowUpStatus(task.id, "done");
                              toast.success("Follow-up completed");
                            } catch (error) {
                              toast.error("Follow-up could not be completed", {
                                description:
                                  error instanceof Error
                                    ? error.message
                                    : "Refresh and try again.",
                              });
                            }
                          }}
                        >
                          Complete
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No follow-ups"
                description="CRM-linked company tasks appear here."
              />
            )}
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
              <Input
                value={followUpTitle}
                onChange={(event) => setFollowUpTitle(event.target.value)}
                placeholder="Follow-up title"
                disabled={isArchived}
              />
              <Input
                value={followUpDueDate}
                onChange={(event) => setFollowUpDueDate(event.target.value)}
                placeholder="Due date (YYYY-MM-DD)"
                aria-label="Follow-up due date"
                disabled={isArchived}
              />
              <Button
                variant="outline"
                disabled={isArchived}
                onClick={async () => {
                  try {
                    await addFollowUp({
                      companyId: deal.companyId,
                      leadId: deal.leadId,
                      dealId: deal.id,
                      title: followUpTitle,
                      dueDate: followUpDueDate,
                      assignee: deal.owner.name,
                      priority: "high",
                    });
                    setFollowUpTitle("");
                    setFollowUpDueDate("");
                    toast.success("Follow-up created");
                  } catch (error) {
                    toast.error("Follow-up could not be created", {
                      description:
                        error instanceof Error
                          ? error.message
                          : "Refresh and try again.",
                    });
                  }
                }}
              >
                Add follow-up
              </Button>
            </div>
          </DetailPanel>
          <DetailPanel>
            <SectionRuleHeading label="Pursuit playbook" />
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-start">
              <div>
                <ol className="mt-4 space-y-2 text-sm">
                  {CRM_PURSUIT_PLAYBOOK.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <span>
                        {step.title}
                        <span className="block text-xs text-muted-foreground">
                          {step.offsetDays === 0
                            ? "Due today"
                            : `Due in ${step.offsetDays} days`}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <Button
                variant="outline"
                disabled={
                  isArchived || isStartingPlaybook || pursuitPlaybookComplete
                }
                onClick={async () => {
                  setIsStartingPlaybook(true);
                  try {
                    await startPursuitPlaybook(deal.id);
                    toast.success("Pursuit playbook added to Tasks");
                  } catch (error) {
                    toast.error("Pursuit playbook could not be completed", {
                      description:
                        error instanceof Error
                          ? error.message
                          : "Review the created tasks and try again.",
                    });
                  } finally {
                    setIsStartingPlaybook(false);
                  }
                }}
              >
                {pursuitPlaybookComplete
                  ? "Playbook started"
                  : isStartingPlaybook
                    ? "Creating tasks..."
                    : pursuitPlaybookStarted
                      ? "Resume playbook"
                      : "Start playbook"}
              </Button>
            </div>
          </DetailPanel>
          <DetailPanel>
            <SectionRuleHeading label="Attachments" />
            <p className="text-sm text-muted-foreground">
              Link an existing document by its document identifier. Source
              permissions remain unchanged.
            </p>
            <div className="mt-4 space-y-4">
              <ul className="divide-y divide-border rounded-md border border-border">
                {dealAttachments.map((name) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-4 px-3 py-2 text-sm"
                  >
                    <span>{name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isArchived}
                      onClick={async () => {
                        try {
                          await removeAttachment(deal.id, name);
                          toast.success("Document link removed");
                        } catch (error) {
                          toast.error("Document link could not be removed", {
                            description:
                              error instanceof Error
                                ? error.message
                                : "Refresh and try again.",
                          });
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
                {dealAttachments.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted-foreground">
                    No linked documents.
                  </li>
                ) : null}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={attachmentName}
                  onChange={(event) => setAttachmentName(event.target.value)}
                  placeholder="Existing document ID"
                  disabled={isArchived}
                />
                <Button
                  variant="outline"
                  disabled={isArchived}
                  onClick={async () => {
                    if (!attachmentName.trim()) return;
                    try {
                      await addAttachment(deal.id, attachmentName.trim());
                      setAttachmentName("");
                      toast.success("Document linked");
                    } catch (error) {
                      toast.error("Document could not be linked", {
                        description:
                          error instanceof Error
                            ? error.message
                            : "Verify the document ID and try again.",
                      });
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </DetailPanel>
        </DetailLayout>
      </ContentSectionStack>
    </PageShell>
  );
}
