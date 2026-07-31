"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DetailField, DetailFieldGrid } from "@/components/ds";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { apiFetch } from "@/lib/api-client";
import { flattenProjectTeamAssignees, type ProjectTeamRole } from "./project-team-assignee-options";
import { PunchItemPriorityBadge, PunchItemStatusBadge } from "./punch-item-status-badge";
import { usePunchItem } from "@/hooks/use-punch-items";

interface PunchItemPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  punchItemId: string | null;
  onViewFullPage: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export function PunchItemPreviewDialog({
  open,
  onOpenChange,
  projectId,
  punchItemId,
  onViewFullPage,
}: PunchItemPreviewDialogProps) {
  const itemQuery = usePunchItem(projectId, punchItemId ?? "");
  const teamQuery = useQuery({
    queryKey: ["project-team-assignees", String(projectId)],
    queryFn: async () => {
      const response = await apiFetch<{ data: ProjectTeamRole[] }>(
        `/api/projects/${projectId}/directory/roles`,
      );
      return flattenProjectTeamAssignees(response.data ?? []);
    },
    enabled: open,
    staleTime: 60_000,
  });

  const item = itemQuery.data;
  const personName = (id: string | null | undefined) =>
    id ? teamQuery.data?.find((person) => person.id === id)?.full_name ?? id : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="form"
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
        data-testid="punch-item-preview-dialog"
      >
        {itemQuery.isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading punch item…
          </div>
        ) : itemQuery.isError || !item ? (
          <div className="space-y-3 py-4">
            <DialogHeader>
              <DialogTitle>Punch item unavailable</DialogTitle>
              <DialogDescription>
                This punch item could not be loaded. It may have been deleted or you may no longer have access.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-3 pr-8 text-left">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">Punch Item #{item.number}</span>
                <PunchItemStatusBadge status={item.status} />
                {item.priority && <PunchItemPriorityBadge priority={item.priority} />}
              </div>
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription className="whitespace-pre-wrap">
                {item.description || "No description provided."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              <section className="space-y-3">
                <SectionRuleHeading label="Assignment" className="mb-0" />
                <DetailFieldGrid columns={2} className="sm:grid-cols-1">
                  <DetailField label="Punch Item Manager" value={personName(item.punch_item_manager_id)} />
                  <DetailField label="Final Approver" value={personName(item.final_approver_id)} />
                  <DetailField label="Assignee Company" value={item.assignee_company} />
                  <DetailField label="Ball in Court" value={item.ball_in_court} />
                  <DetailField label="Due Date" value={formatDate(item.due_date)} />
                </DetailFieldGrid>
              </section>

              <section className="space-y-3">
                <SectionRuleHeading label="Details" className="mb-0" />
                <DetailFieldGrid columns={2} className="sm:grid-cols-1">
                  <DetailField label="Location" value={item.location} />
                  <DetailField label="Trade" value={item.trade} />
                  <DetailField label="Type" value={item.type} />
                  <DetailField label="Reference" value={item.reference} />
                  <DetailField label="Drawing Ref" value={item.drawing_reference} />
                  <DetailField label="Cost Code" value={item.cost_code} />
                </DetailFieldGrid>
              </section>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={onViewFullPage}>
                View punch list
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
