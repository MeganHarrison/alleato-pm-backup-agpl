"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, CalendarDays, ClipboardList, Edit, MapPin, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailField, DetailFieldGrid, EmptyState, ErrorState } from "@/components/ds";
import { Badge } from "@/components/ui/badge";
import { RecordDetailPage, SectionRuleHeading } from "@/components/layout";
import { DetailPropertyItem } from "@/components/ui/detail-property-bar";
import { apiFetch } from "@/lib/api-client";
import {
  flattenProjectTeamAssignees,
  type ProjectTeamRole,
} from "@/components/domain/punch-items/project-team-assignee-options";
import {
  PunchItemFormSheet,
  type PunchItemFormValues,
} from "@/components/domain/punch-items/punch-item-form-sheet";
import {
  PunchItemStatusBadge,
  PunchItemPriorityBadge,
} from "@/components/domain/punch-items/punch-item-status-badge";
import { useUpdatePunchItem } from "@/hooks/use-punch-items";
import type { Database } from "@/types/database.types";

type PunchItemRow = Database["public"]["Tables"]["punch_items"]["Row"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("T")[0].split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Status transition map
// ---------------------------------------------------------------------------

const STATUS_TRANSITIONS: Record<
  PunchItemRow["status"],
  { label: string; next: PunchItemRow["status"] }[]
> = {
  draft: [{ label: "Initiate", next: "initiated" }],
  initiated: [
    { label: "Mark Work Required", next: "work_required" },
    { label: "Close", next: "closed" },
  ],
  work_required: [
    { label: "Re-initiate", next: "initiated" },
    { label: "Close", next: "closed" },
  ],
  closed: [{ label: "Reopen", next: "initiated" }],
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PunchItemDetailProps {
  item: PunchItemRow | null;
  projectId: number;
  punchItemId: string;
  loadError?: string;
}

export function PunchItemDetail({ item, projectId, punchItemId, loadError }: PunchItemDetailProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const updateMutation = useUpdatePunchItem(projectId);

  // Resolve person ids (manager / approver) to names for display.
  const { data: projectTeam = [] } = useQuery({
    queryKey: ["project-team-assignees", String(projectId)],
    queryFn: async () => {
      const res = await apiFetch<{ data: ProjectTeamRole[] }>(
        `/api/projects/${projectId}/directory/roles`,
      );
      return flattenProjectTeamAssignees(res.data ?? []);
    },
    staleTime: 60_000,
  });
  const personName = (id: string | null | undefined): string | null =>
    id ? (projectTeam.find((p) => p.id === id)?.full_name ?? null) : null;

  if (!item) {
    return (
      <RecordDetailPage title="Punch Item">
        {loadError ? (
          <ErrorState
            title="Punch item could not be loaded"
            description="We could not load this punch item. Try again or return to the punch list."
            onRetry={() => router.refresh()}
          />
        ) : (
          <EmptyState
            icon={<ClipboardList />}
            title="Punch item not found"
            description="This punch item could not be found or may have been deleted."
            action={<Button variant="outline" onClick={() => router.push(`/${projectId}/punch-list`)}><ArrowLeft />Back to Punch List</Button>}
          />
        )}
      </RecordDetailPage>
    );
  }

  const handleEditSubmit = (data: PunchItemFormValues) => {
    updateMutation.mutate(
      { punchItemId, data },
      { onSuccess: () => setEditOpen(false) },
    );
  };

  const handleStatusTransition = (next: PunchItemRow["status"]) => {
    updateMutation.mutate({ punchItemId, data: { status: next } });
  };

  const transitions = STATUS_TRANSITIONS[item.status] ?? [];

  return (
    <RecordDetailPage
      title={item.title}
      eyebrow={`Punch item #${item.number}`}
      statusBadge={
        <div className="flex items-center gap-2">
          <PunchItemStatusBadge status={item.status} />
          {item.priority && <PunchItemPriorityBadge priority={item.priority} />}
          {item.is_deleted && (
            <Badge variant="destructive">
              <X className="mr-1 h-3 w-3" />
              Deleted
            </Badge>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${projectId}/punch-list`)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Punch List
          </Button>
          {transitions.map((t) => (
            <Button
              key={t.next}
              size="sm"
              variant="outline"
              disabled={updateMutation.isPending}
              onClick={() => handleStatusTransition(t.next)}
            >
              {t.label}
            </Button>
          ))}
          <Button size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="mr-1 h-4 w-4" />
            Edit
          </Button>
        </div>
      }
      properties={
        <>
          <DetailPropertyItem icon={UserRound} muted={!personName(item.punch_item_manager_id)}>
            {personName(item.punch_item_manager_id) ?? "Assign manager"}
          </DetailPropertyItem>
          <DetailPropertyItem icon={Building2} muted={!item.ball_in_court}>
            {item.ball_in_court ?? "Set ball in court"}
          </DetailPropertyItem>
          <DetailPropertyItem icon={CalendarDays} muted={!item.due_date}>
            {item.due_date ? `Due ${formatDate(item.due_date)}` : "Set due date"}
          </DetailPropertyItem>
          <DetailPropertyItem icon={MapPin} muted={!item.location}>
            {item.location ?? "Add location"}
          </DetailPropertyItem>
        </>
      }
    >
      {item.description ? (
        <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {item.description}
        </p>
      ) : null}

      <section className="space-y-4">
        <SectionRuleHeading label="Assignment" />
        <DetailFieldGrid columns={2}>
          <DetailField label="Punch Item Manager" value={personName(item.punch_item_manager_id)} />
          <DetailField label="Final Approver" value={personName(item.final_approver_id)} />
          <DetailField label="Assignee Company" value={item.assignee_company} />
          <DetailField label="Ball in Court" value={item.ball_in_court} />
          <DetailField label="Due Date" value={formatDate(item.due_date)} />
          <DetailField label="Date Notified" value={formatDateTime(item.date_notified)} />
          <DetailField label="Date Resolved" value={formatDateTime(item.date_resolved)} />
          <DetailField label="Date Closed" value={formatDateTime(item.date_closed)} />
        </DetailFieldGrid>
      </section>

      <section className="space-y-4">
        <SectionRuleHeading label="Categorisation" />
        <DetailFieldGrid columns={2}>
          <DetailField label="Location" value={item.location} />
          <DetailField label="Trade" value={item.trade} />
          <DetailField label="Type" value={item.type} />
          <DetailField label="Reference" value={item.reference} />
          <DetailField label="Drawing Ref" value={item.drawing_reference} />
          <DetailField label="Cost Code" value={item.cost_code} />
          {item.cost_impact != null && (
            <DetailField label="Cost Impact" value={item.cost_impact} currency />
          )}
          <DetailField label="Private" value={item.is_private ? "Yes" : "No"} />
        </DetailFieldGrid>
      </section>

      <details className="space-y-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
          Record history
        </summary>
        <DetailFieldGrid columns={2}>
          <DetailField label="Created" value={formatDateTime(item.created_at)} />
          <DetailField label="Last Updated" value={formatDateTime(item.updated_at)} />
        </DetailFieldGrid>
      </details>

      <PunchItemFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEditSubmit}
        defaultValues={item}
        isLoading={updateMutation.isPending}
        mode="edit"
        projectId={projectId}
      />
    </RecordDetailPage>
  );
}
