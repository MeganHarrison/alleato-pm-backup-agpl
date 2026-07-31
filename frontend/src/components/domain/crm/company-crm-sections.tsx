"use client";

import * as React from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { handleFormError } from "@/lib/handle-form-error";
import { formatDate } from "@/lib/format";
import { SectionAction, SectionRuleHeading } from "@/components/layout";
import { EmptyState, StatusBadge } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/forms/DateField";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Deals + manually-logged CRM activity for one company. Automated
// communications (emails, meetings, Teams) are NOT duplicated here — they
// already resolve to this company via the shared identity tables.

interface CompanyDeal {
  id: string;
  name: string;
  status: "open" | "won" | "lost";
  value: number | null;
  expected_close_date: string | null;
  stage: { id: string; name: string } | null;
  owner: { id: string; first_name: string | null; last_name: string | null } | null;
}

interface CompanyActivity {
  id: string;
  activity_type: "call" | "email" | "meeting" | "note" | "follow_up";
  subject: string;
  body: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string | null;
  deal: { id: string; name: string } | null;
}

interface CompanyCrmSectionsProps {
  companyId: string;
  lifecycleStage: string;
}

const ACTIVITY_TYPE_OPTIONS: Array<{ value: CompanyActivity["activity_type"]; label: string }> = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "follow_up", label: "Follow-up" },
];

const ACTIVITY_TYPE_LABELS = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

function formatDealValue(value: number | null): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface LogActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  deals: CompanyDeal[];
  onLogged: () => void;
}

function LogActivityDialog({
  open,
  onOpenChange,
  companyId,
  deals,
  onLogged,
}: LogActivityDialogProps): ReactElement {
  const [activityType, setActivityType] =
    React.useState<CompanyActivity["activity_type"]>("call");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [dueAt, setDueAt] = React.useState<Date | undefined>(undefined);
  const [dealId, setDealId] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setActivityType("call");
    setSubject("");
    setBody("");
    setDueAt(undefined);
    setDealId("");
  }, [open]);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch("/api/crm/activities", {
        method: "POST",
        body: JSON.stringify({
          company_id: companyId,
          deal_id: dealId || null,
          activity_type: activityType,
          subject: subject.trim(),
          body: body.trim() || null,
          due_at: dueAt ? dueAt.toISOString() : null,
        }),
      });
      toast.success("Activity logged");
      onOpenChange(false);
      onLogged();
    } catch (submitError) {
      handleFormError(submitError, { entity: "activity", action: "create" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle>Log activity</ModalTitle>
          <ModalDescription>
            Record a touchpoint or schedule a follow-up for this company.
          </ModalDescription>
        </ModalHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={activityType}
                onValueChange={(next) =>
                  setActivityType(next as CompanyActivity["activity_type"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateField label="Follow-up due" value={dueAt} onChange={setDueAt} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="activity-subject">Subject</Label>
            <Input
              id="activity-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Call — bid scope review"
              autoFocus
            />
          </div>
          {deals.length > 0 ? (
            <div className="grid gap-2">
              <Label>Related deal</Label>
              <Select value={dealId || undefined} onValueChange={setDealId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="activity-body">Notes</Label>
            <Textarea
              id="activity-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving…" : "Log activity"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function CompanyCrmSections({
  companyId,
  lifecycleStage,
}: CompanyCrmSectionsProps): ReactElement | null {
  const [deals, setDeals] = React.useState<CompanyDeal[]>([]);
  const [activities, setActivities] = React.useState<CompanyActivity[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isLogOpen, setIsLogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [dealsPayload, activitiesPayload] = await Promise.all([
        apiFetch<{ data: CompanyDeal[] }>(`/api/crm/deals?companyId=${companyId}`, {
          cache: "no-store",
        }),
        apiFetch<{ data: CompanyActivity[] }>(
          `/api/crm/activities?companyId=${companyId}`,
          { cache: "no-store" },
        ),
      ]);
      setDeals(dealsPayload.data);
      setActivities(activitiesPayload.data);
    } catch (loadError) {
      // Non-fatal: CRM sections stay hidden if the data can't load.
      console.error("[CompanyCRM] Failed to load CRM sections:", loadError);
    } finally {
      setIsLoaded(true);
    }
  }, [companyId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const isProspect = lifecycleStage !== "active";

  if (!isLoaded || (!isProspect && deals.length === 0 && activities.length === 0)) {
    return null;
  }

  return (
    <>
      {deals.length > 0 ? (
        <section className="space-y-4">
          <SectionRuleHeading label="Deals" />
          <ul className="divide-y divide-border">
            {deals.map((deal) => (
              <li key={deal.id} className="flex items-center gap-3 py-2 text-sm">
                <Link
                  href={`/deals?search=${encodeURIComponent(deal.name)}`}
                  className="min-w-0 flex-1 truncate font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {deal.name}
                </Link>
                <span className="shrink-0 text-muted-foreground">{deal.stage?.name}</span>
                {deal.value != null ? (
                  <span className="shrink-0 tabular-nums">{formatDealValue(deal.value)}</span>
                ) : null}
                <StatusBadge status={deal.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionRuleHeading
          label="CRM Activity"
          actions={
            activities.length > 0 ? (
              <SectionAction onClick={() => setIsLogOpen(true)}>Log activity</SectionAction>
            ) : undefined
          }
        />
        {activities.length === 0 ? (
          <EmptyState
            title="No activity logged"
            description="Track calls, meetings, and follow-ups for this company."
            action={
              <Button size="sm" onClick={() => setIsLogOpen(true)}>
                Log activity
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {activities.map((activity) => {
              const isOpenFollowUp = activity.due_at && !activity.completed_at;
              return (
                <li key={activity.id} className="py-3 text-sm">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {ACTIVITY_TYPE_LABELS[activity.activity_type]} — {activity.subject}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {isOpenFollowUp && activity.due_at
                        ? `due ${formatDate(activity.due_at)}`
                        : activity.created_at
                          ? formatDate(activity.created_at)
                          : null}
                    </p>
                  </div>
                  {activity.body ? (
                    <p className="mt-1 max-w-prose text-muted-foreground">{activity.body}</p>
                  ) : null}
                  {activity.deal ? (
                    <p className="mt-1 text-xs text-muted-foreground">{activity.deal.name}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <LogActivityDialog
        open={isLogOpen}
        onOpenChange={setIsLogOpen}
        companyId={companyId}
        deals={deals}
        onLogged={load}
      />
    </>
  );
}
