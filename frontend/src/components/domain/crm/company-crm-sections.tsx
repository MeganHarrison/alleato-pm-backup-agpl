"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import { EmptyState, StatusBadge } from "@/components/ds";
import { SectionAction, SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { useCrmWorkspace } from "@/hooks/use-crm";
import { buildCrmAccountTimeline } from "@/features/crm/account-timeline";
import { formatCurrency, formatDate } from "@/lib/format";

export function CompanyCrmSections({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const {
    accounts,
    deals,
    activities,
    followUps,
    dealStageEvents,
    enrollCompany,
    addActivity,
  } = useCrmWorkspace();
  const [isLogOpen, setIsLogOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const profile = accounts.find((account) => account.companyId === companyId);
  const companyDeals = deals.filter((deal) => deal.companyId === companyId);
  const timeline = buildCrmAccountTimeline({
    companyId,
    deals,
    activities,
    followUps,
    stageEvents: dealStageEvents,
  });

  if (!profile) {
    return (
      <section className="space-y-4">
        <SectionRuleHeading label="CRM relationship" />
        <EmptyState
          title="This company is not in CRM"
          description="Add a CRM relationship profile without changing the ERP-owned company record."
          action={
            <Button
              onClick={async () => {
                try {
                  await enrollCompany(companyId);
                  toast.success("Company added to CRM");
                } catch (error) {
                  toast.error("Company could not be added to CRM", {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Refresh and try again.",
                  });
                }
              }}
            >
              Add to CRM
            </Button>
          }
        />
      </section>
    );
  }

  const logActivity = async () => {
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    try {
      await addActivity({
        companyId,
        companyName: profile.name,
        dealId: null,
        activityType: "note",
        subject: notes.trim()
          ? `${subject.trim()} — ${notes.trim()}`
          : subject.trim(),
        visibilityScope: "standard",
      });
      setSubject("");
      setNotes("");
      setIsLogOpen(false);
      toast.success("Activity saved");
    } catch (error) {
      toast.error("Activity could not be saved", {
        description:
          error instanceof Error ? error.message : "Refresh and try again.",
      });
    }
  };

  return (
    <>
      <section className="space-y-4">
        <SectionRuleHeading
          label="CRM relationship"
          actions={
            <SectionAction onClick={() => setIsLogOpen(true)}>
              Log activity
            </SectionAction>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Lifecycle</p>
            <StatusBadge status={profile.lifecycleStage} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Health</p>
            <StatusBadge status={profile.healthStatus} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Health evaluated</p>
            <p className="text-sm">{formatDate(profile.healthEvaluatedAt)}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{profile.healthReason}</p>
      </section>

      <section className="space-y-4">
        <SectionRuleHeading label="Deals" />
        {companyDeals.length ? (
          <ul className="divide-y divide-border">
            {companyDeals.map((deal) => (
              <li
                key={deal.id}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <Link
                  href={`/crm/deals/${deal.id}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {deal.name}
                </Link>
                <span className="tabular-nums">
                  {formatCurrency(deal.valueEstimate)}
                </span>
                <StatusBadge status={deal.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No CRM deals for this company.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <SectionRuleHeading label="Relationship timeline" />
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
          <p className="text-sm text-muted-foreground">
            No calls, emails, meetings, notes, tasks, or stage changes yet.
          </p>
        )}
      </section>

      <Modal open={isLogOpen} onOpenChange={setIsLogOpen}>
        <ModalContent className="sm:max-w-md">
          <ModalHeader>
            <ModalTitle>Log CRM activity</ModalTitle>
            <ModalDescription>
              Saves to the shared relationship history.
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="crm-company-activity-subject">Subject</Label>
              <Input
                id="crm-company-activity-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-company-activity-notes">Notes</Label>
              <Textarea
                id="crm-company-activity-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsLogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={logActivity}>Log activity</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
