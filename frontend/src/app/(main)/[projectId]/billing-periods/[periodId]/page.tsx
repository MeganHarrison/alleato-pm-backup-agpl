"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";
import {
  ContentSectionStack,
  DetailPanel,
  PageShell,
  SectionRuleHeading,
} from "@/components/layout";
import {
  DetailField,
  DetailFieldGrid,
  EditableDetailField,
} from "@/components/ds";
import { formatDate } from "@/lib/format";
import {
  billingPeriodKeys,
  useBillingPeriod,
} from "@/hooks/use-billing-periods";

export default function BillingPeriodDetailPage(): ReactElement {
  const params = useParams<{ projectId: string; periodId: string }>()! ?? {
    projectId: "",
    periodId: "",
  };
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = params.projectId ?? "";
  const periodId = params.periodId ?? "";

  const {
    data: period,
    isLoading,
    error,
  } = useBillingPeriod(projectId, periodId);

  const handleBack = React.useCallback(() => {
    router.push(`/${projectId}/invoices?tab=billing-periods`);
  }, [projectId, router]);

  // Single inline-save handler. apiFetch throws on non-2xx, which EditableDetailField
  // catches to toast + revert; on success we invalidate so the new value persists.
  const handleSaveField = React.useCallback(
    async (field: string, value: string | boolean | null) => {
      await apiFetch(
        `/api/projects/${projectId}/invoicing/billing-periods/${periodId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ [field]: value }),
        },
      );
      await queryClient.invalidateQueries({
        queryKey: billingPeriodKeys.detail(periodId),
      });
      await queryClient.invalidateQueries({
        queryKey: billingPeriodKeys.lists(),
      });
      router.refresh();
    },
    [projectId, periodId, queryClient, router],
  );

  if (isLoading) {
    return (
      <PageShell
        variant="detail"
        title="Billing Period"
        description="Loading billing period…"
        onBack={handleBack}
      >
        <div />
      </PageShell>
    );
  }

  if (error || !period) {
    return (
      <PageShell
        variant="detail"
        title="Billing Period"
        description="Unable to load billing period"
        onBack={handleBack}
      >
        <p className="text-sm text-muted-foreground">
          {error instanceof Error
            ? error.message
            : "This billing period could not be found."}
        </p>
      </PageShell>
    );
  }

  const eyebrow = `BP-${String(period.period_number).padStart(3, "0")}`;
  const dateRange =
    period.start_date && period.end_date
      ? `${formatDate(period.start_date)} – ${formatDate(period.end_date)}`
      : `Billing Period ${period.period_number}`;
  const title = period.name || dateRange;
  const isClosed = period.is_closed === true;

  const statusDisplay = (
    <span
      className={
        isClosed
          ? "text-xs font-medium text-muted-foreground"
          : "text-xs font-medium text-primary"
      }
    >
      {isClosed ? "Closed" : "Open"}
    </span>
  );

  return (
    <PageShell
      variant="detail"
      eyebrow={<>{eyebrow}</>}
      title={title}
      onBack={handleBack}
    >
      <ContentSectionStack className="pt-3">
        <DetailPanel>
          <SectionRuleHeading label="General Information" />
          <DetailFieldGrid columns={2}>
            <EditableDetailField
              label="Period Name"
              type="text"
              value={period.name ?? ""}
              emptyPlaceholder="Add name"
              onSave={(v) =>
                handleSaveField("name", v.trim() === "" ? null : v)
              }
            />

            <EditableDetailField
              label="Status"
              type="select"
              value={String(isClosed)}
              display={statusDisplay}
              options={[
                { value: "false", label: "Open" },
                { value: "true", label: "Closed" },
              ]}
              onSave={(v) => handleSaveField("is_closed", v === "true")}
            />

            <EditableDetailField
              label="Start Date"
              type="date"
              value={period.start_date ?? ""}
              display={
                period.start_date ? formatDate(period.start_date) : undefined
              }
              emptyPlaceholder="Set date"
              onSave={(v) => handleSaveField("start_date", v || null)}
            />

            <EditableDetailField
              label="End Date"
              type="date"
              value={period.end_date ?? ""}
              display={
                period.end_date ? formatDate(period.end_date) : undefined
              }
              emptyPlaceholder="Set date"
              onSave={(v) => handleSaveField("end_date", v || null)}
            />

            <EditableDetailField
              label="Due Date"
              type="date"
              value={period.due_date ?? ""}
              display={
                period.due_date ? formatDate(period.due_date) : undefined
              }
              emptyPlaceholder="Set date"
              onSave={(v) => handleSaveField("due_date", v || null)}
            />

            <DetailField label="Period Number">{eyebrow}</DetailField>

            {period.created_at ? (
              <DetailField label="Created">
                {formatDate(period.created_at)}
              </DetailField>
            ) : null}
          </DetailFieldGrid>
        </DetailPanel>
      </ContentSectionStack>
    </PageShell>
  );
}
