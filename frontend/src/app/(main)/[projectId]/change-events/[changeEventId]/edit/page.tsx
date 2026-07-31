"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api-client";
import { ChangeEventForm } from "@/components/domain/change-events/ChangeEventForm";
import type { ChangeEventFormData } from "@/components/domain/change-events/ChangeEventForm";
import { FormServerError } from "@/components/forms/FormServerError";
import { FormContainer, PageShell } from "@/components/layout";
import { useChangeEventDetail } from "@/hooks/use-change-event-detail";

export const dynamic = "force-dynamic";

// Normalize DB origin values to form option values
const ORIGIN_NORMALIZE: Record<string, string> = {
  Emails: "emails",
  Meetings: "meetings",
  "RFI's": "rfis",
  Internal: "Internal",
  Field: "Field",
};

// Same maps as create page — accepted by the server-side normalizer
const STATUS_MAP: Record<string, string> = {
  open: "Open",
  pending: "Pending Approval",
  "pending approval": "Pending Approval",
  close: "Closed",
  closed: "Closed",
  void: "Void",
  Open: "Open",
  "Pending Approval": "Pending Approval",
  Approved: "Approved",
  Rejected: "Rejected",
  Closed: "Closed",
  Void: "Void",
  Converted: "Converted",
};

const ORIGIN_MAP: Record<string, string> = {
  emails: "Emails",
  meetings: "Meetings",
  rfis: "RFI's",
  Internal: "Internal",
  Field: "Field",
};

const TYPE_MAP: Record<string, string> = {
  "Owner Change": "Owner Change",
  "Design Change": "Design Change",
  Allowance: "Allowance",
  Contingency: "Contingency",
  "Scope Gap": "Scope Gap",
  TBD: "TBD",
  Transfer: "Transfer",
  "Unforeseen Condition": "Unforeseen Condition",
  "Value Engineering": "Value Engineering",
  "Owner Requested": "Owner Requested",
  "Constructability Issue": "Constructability Issue",
  allowance: "Allowance",
  contingency: "Contingency",
  owner_change: "Owner Change",
  design_change: "Design Change",
  tbd: "TBD",
  transfer: "Transfer",
};

const REASON_MAP: Record<string, string> = {
  Allowance: "Allowance",
  "Back Charge": "Back Charge",
  "Client Request": "Client Request",
  "Design Development": "Design Development",
  "Existing Condition": "Existing Condition",
  allowance: "Allowance",
  backcharge: "Back Charge",
  back_charge: "Back Charge",
  client_request: "Client Request",
  design_development: "Design Development",
  existing_condition: "Existing Condition",
};

export default function EditChangeEventPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const projectId = parseInt(params.projectId as string, 10);
  const changeEventId = params.changeEventId as string;

  const [isSaving, setIsSaving] = useState(false);

  const { changeEvent, lineItems, isLoading, error } = useChangeEventDetail(
    projectId,
    changeEventId,
  );

  const initialData = useMemo<Partial<ChangeEventFormData>>(() => {
    if (!changeEvent) return {};
    return {
      number: changeEvent.number ?? undefined,
      contractNumber: "",
      title: changeEvent.title ?? "",
      status: changeEvent.status ?? "Open",
      type: changeEvent.type ?? "",
      scope: changeEvent.scope ?? "TBD",
      origin:
        ORIGIN_NORMALIZE[changeEvent.origin ?? ""] ??
        changeEvent.origin ??
        undefined,
      originId: changeEvent.originId ?? changeEvent.origin_id ?? undefined,
      changeReason: changeEvent.reason ?? "",
      description: changeEvent.description ?? "",
      expectingRevenue:
        changeEvent.expectingRevenue ??
        changeEvent.expecting_revenue ??
        true,
      lineItemRevenueSource:
        changeEvent.lineItemRevenueSource ??
        changeEvent.line_item_revenue_source ??
        "",
      primeContractId: String(
        changeEvent.primeContractId ?? changeEvent.prime_contract_id ?? "",
      ),
      attachments: [],
      lineItems: (lineItems ?? []).map((li) => {
        const prefixedCommitmentId = li.commitmentId
          ? `${li.commitmentType === "purchase_order" ? "po" : "sub"}-${li.commitmentId}`
          : "";
        return {
          id: li.id,
          budgetCode: li.projectBudgetCodeId ?? "",
          description: li.description ?? "",
          vendor: li.vendorId ?? li.vendor?.id ?? li.commitment?.contract_company_id ?? "",
          vendorName: li.vendor?.name ?? li.commitment?.company_name ?? "",
          contract: prefixedCommitmentId,
          commitmentId: prefixedCommitmentId || undefined,
            commitmentLineItemId: li.commitmentLineItemId ?? "",
          revenueUnitOfMeasure: li.unitOfMeasure ?? "",
          revenueQuantity: li.quantity ?? 1,
          revenueUnitCost: li.unitCost ?? 0,
          revenueRom: li.revenueRom ?? 0,
          costQuantity: li.quantity ?? 1,
          costUnitCost: li.unitCost ?? 0,
          costRom: li.costRom ?? 0,
          nonCommittedCost: li.nonCommittedCost ?? 0,
        };
      }),
    };
  }, [changeEvent, lineItems]);

  const originalLineItemIds = useMemo(
    () => new Set((lineItems ?? []).map((li) => li.id)),
    [lineItems],
  );

  const handleSubmit = async (data: ChangeEventFormData) => {
    setIsSaving(true);
    try {
      const normalizedScope =
        data.scope && ["In Scope", "Out of Scope", "TBD", "Allowance"].includes(data.scope)
          ? data.scope
          : "TBD";

      // PATCH change event header
      await apiFetch(
        `/api/projects/${projectId}/change-events/${changeEventId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            type: data.type ? (TYPE_MAP[data.type] ?? data.type) : undefined,
            status: STATUS_MAP[data.status || "Open"] || data.status || "Open",
            scope: normalizedScope,
            reason: data.changeReason
              ? (REASON_MAP[data.changeReason] ?? data.changeReason)
              : undefined,
            origin:
              data.origin === undefined
                ? undefined
                : (ORIGIN_MAP[data.origin] ?? data.origin ?? null),
            originId: data.origin ? (data.originId || undefined) : null,
            expectingRevenue: data.expectingRevenue ?? true,
            lineItemRevenueSource: data.lineItemRevenueSource || undefined,
            primeContractId: data.primeContractId || undefined,
            description: data.description || undefined,
          }),
        },
      );

      // Compute which original line items were deleted
      const submittedIds = new Set(
        data.lineItems.filter((li) => li.id).map((li) => li.id as string),
      );
      const deletedIds = [...originalLineItemIds].filter((id) => !submittedIds.has(id));

      // DELETE removed line items
      await Promise.all(
        deletedIds.map((id) =>
          apiFetch(
            `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${id}`,
            { method: "DELETE" },
          ),
        ),
      );

      // PATCH existing or POST new line items
      const nonEmptyItems = data.lineItems.filter(
        (li) =>
          li.description.trim().length > 0 ||
          li.budgetCode.trim().length > 0 ||
          li.costUnitCost > 0 ||
          li.revenueRom > 0 ||
          li.costRom > 0 ||
          li.nonCommittedCost > 0,
      );

      const lineItemResults = await Promise.allSettled(
        nonEmptyItems.map(async (li, index) => {
          const payload = {
            description: li.description || `Line Item ${index + 1}`,
            quantity: li.costQuantity || undefined,
            unitCost: li.costUnitCost || undefined,
            unitOfMeasure: li.revenueUnitOfMeasure || undefined,
            costRom: li.costRom || undefined,
            revenueRom: data.expectingRevenue === false ? undefined : li.revenueRom || undefined,
            nonCommittedCost: li.nonCommittedCost || undefined,
            sortOrder: index,
            budgetCodeId: li.budgetCode || undefined,
            vendorId: li.vendor || undefined,
            ...(li.contract && /^(po|sub)-/.test(li.contract)
              ? { commitmentId: li.contract.replace(/^(po-|sub-)/, "") }
              : { contractId: li.contract || undefined }),
            commitmentLineItemId: li.commitmentLineItemId || undefined,
          };

          if (li.id && originalLineItemIds.has(li.id)) {
            return apiFetch(
              `/api/projects/${projectId}/change-events/${changeEventId}/line-items/${li.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );
          } else {
            return apiFetch(
              `/api/projects/${projectId}/change-events/${changeEventId}/line-items`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );
          }
        }),
      );

      const failed = lineItemResults.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        const reasons = failed
          .map((r) => (r as PromiseRejectedResult).reason?.message)
          .filter(Boolean)
          .join("; ");
        toast.error(
          `Change event saved but ${failed.length} line item(s) failed: ${reasons}`,
        );
      }

      const attachmentResults = await Promise.allSettled(
        data.attachments.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          return apiFetch(
            `/api/projects/${projectId}/change-events/${changeEventId}/attachments`,
            {
              method: "POST",
              body: formData,
            },
          );
        }),
      );

      const failedAttachments = attachmentResults.filter(
        (result) => result.status === "rejected",
      );
      if (failedAttachments.length > 0) {
        const reasons = failedAttachments
          .map((result) => (result as PromiseRejectedResult).reason?.message)
          .filter(Boolean)
          .join("; ");
        const message = `Change event saved but ${failedAttachments.length} attachment(s) failed: ${reasons}`;
        toast.error(message);
        throw new Error(message);
      }

      toast.success("Change event updated");

      router.push(`/${projectId}/change-events/${changeEventId}`);
    } catch (err) {
      // Re-throw so ChangeEventForm surfaces the message via FormServerError
      // (errors.root); also toast for immediate feedback.
      const message = err instanceof Error ? err.message : "Failed to save change event";
      toast.error(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/${projectId}/change-events/${changeEventId}`);
  };

  if (isLoading) {
    return (
      <PageShell
        variant="form"
        title="Edit Change Event"
        onBack={handleCancel}
      >
        <div className="text-muted-foreground text-sm">Loading…</div>
      </PageShell>
    );
  }

  if (error || !changeEvent) {
    return (
      <PageShell
        variant="form"
        title="Edit Change Event"
        onBack={handleCancel}
      >
        <FormServerError message="Failed to load change event." />
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title={`Edit ${changeEvent.title || "Change Event"}`}
      description="Update change event details and line items."
      onBack={handleCancel}
    >
      <FormContainer maxWidth="xl" withCard={false}>
        <ChangeEventForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSaving}
          mode="edit"
          projectId={projectId}
        />
      </FormContainer>
    </PageShell>
  );
}
