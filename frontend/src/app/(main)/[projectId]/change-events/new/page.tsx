"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { ChangeEventForm } from "@/components/domain/change-events/ChangeEventForm";
import type { ChangeEventFormData } from "@/components/domain/change-events/ChangeEventForm";
import { FormContainer, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

export default function NewChangeEventPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const projectId = parseInt(params.projectId as string, 10);

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (data: ChangeEventFormData) => {
    setIsSaving(true);
    try {
      // The form emits display strings (e.g. "Open", "Pending Approval", "Design Change").
      // The server-side validation.ts uses createNormalizedEnum which accepts these directly.
      // STATUS_MAP: keys are display strings (what STATUS_OPTIONS emits) → pass through unchanged.
      const STATUS_MAP: Record<string, string> = {
        // Slug fallbacks for any legacy callers
        open: "Open",
        pending: "Pending Approval",
        "pending approval": "Pending Approval",
        close: "Closed",
        closed: "Closed",
        void: "Void",
        // Display string pass-through
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
      // TYPE_MAP: keys are display strings (what TYPE_OPTIONS emits). All types must be present.
      const TYPE_MAP: Record<string, string> = {
        // Display string pass-through
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
        // Slug fallbacks
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
        // Slug fallbacks
        allowance: "Allowance",
        backcharge: "Back Charge",
        back_charge: "Back Charge",
        client_request: "Client Request",
        design_development: "Design Development",
        existing_condition: "Existing Condition",
      };

      const normalizedScope = data.scope && ["In Scope", "Out of Scope", "TBD", "Allowance"].includes(data.scope)
        ? data.scope
        : "TBD";

      const mergedDescription = [
        data.contractNumber ? `Contract Number: ${data.contractNumber}` : "",
        data.description || "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const newEvent = await apiFetch<{ id: string }>(`/api/projects/${projectId}/change-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          type: (data.type ? (TYPE_MAP[data.type] ?? data.type) : undefined),
          status: STATUS_MAP[data.status || "Open"] || data.status || "Open",
          scope: normalizedScope,
          reason: data.changeReason ? (REASON_MAP[data.changeReason] ?? data.changeReason) : undefined,
          origin: ORIGIN_MAP[data.origin || ""] || "Internal",
          originId: data.originId || undefined,
          expectingRevenue: data.expectingRevenue ?? true,
          lineItemRevenueSource: data.lineItemRevenueSource || undefined,
          primeContractId: data.primeContractId || undefined,
          description: mergedDescription || undefined,
        }),
      });

      const lineItemResults = await Promise.allSettled(
        data.lineItems
          .filter((lineItem) => {
            return (
              lineItem.description.trim().length > 0 ||
              lineItem.budgetCode.trim().length > 0 ||
              lineItem.costUnitCost > 0 ||
              lineItem.revenueRom > 0 ||
              lineItem.costRom > 0 ||
              lineItem.nonCommittedCost > 0
            );
          })
          .map(async (lineItem, index) => {
            return apiFetch(
              `/api/projects/${projectId}/change-events/${newEvent.id}/line-items`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  description:
                    lineItem.description ||
                    `${lineItem.budgetCode || "Line Item"} ${index + 1}`,
                  quantity: lineItem.costQuantity || undefined,
                  unitCost: lineItem.costUnitCost || undefined,
                  unitOfMeasure: lineItem.revenueUnitOfMeasure || undefined,
                  costRom: lineItem.costRom || undefined,
                  revenueRom:
                    data.expectingRevenue === false
                      ? undefined
                      : lineItem.revenueRom || undefined,
                  nonCommittedCost: lineItem.nonCommittedCost || undefined,
                  sortOrder: index,
                  budgetCodeId: lineItem.budgetCode || undefined,
                  vendorId: lineItem.vendor || undefined,
                  // contract stores either "po-<uuid>" / "sub-<uuid>" (commitment) or a plain UUID (prime contract).
                  // Commitment identity is always submitted as an ID/type pair.
                  ...(lineItem.contract && /^(po|sub)-/.test(lineItem.contract)
                    ? {
                        commitmentId: lineItem.contract.replace(/^(po-|sub-)/, ""),
                        commitmentType: lineItem.contract.startsWith("po-")
                          ? "purchase_order"
                          : "subcontract",
                      }
                    : { contractId: lineItem.contract || undefined }),
                  commitmentLineItemId: lineItem.commitmentLineItemId || undefined,
                }),
              },
            );
          }),
      );
      const failedLineItems = lineItemResults.filter((r) => r.status === "rejected");
      if (failedLineItems.length > 0) {
        const reasons = failedLineItems
          .map((r) => (r as PromiseRejectedResult).reason?.message)
          .filter(Boolean)
          .join("; ");
        toast.error(`Change event created but ${failedLineItems.length} line item(s) failed to save: ${reasons}`);
      }

      await Promise.all(
        data.attachments.map(async (file) => {
          const formData = new FormData();
          formData.append("files", file);
          await apiFetch(
            `/api/projects/${projectId}/change-events/${newEvent.id}/attachments`,
            {
              method: "POST",
              body: formData,
            },
          );
        }),
      );

      toast.success("Change event created successfully");
      router.push(`/${projectId}/change-events/${newEvent.id}`);
    } catch (error) {
      // Re-throw so ChangeEventForm surfaces the message via FormServerError
      // (errors.root); also toast for immediate feedback.
      const message = error instanceof Error
        ? error.message
        : "Failed to create change event";
      toast.error(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/${projectId}/change-events`);
  };

  const initialData: Partial<ChangeEventFormData> = {
    contractNumber: "",
    title: "",
    status: "Open",
    attachments: [],
    lineItems: [],
  };

  const headerActions =
    process.env.NODE_ENV !== "production" ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent("dev-autofill-form", {
              detail: { selector: 'form[data-form-id="change-event-create"]' },
            }),
          );
        }}
      >
        <Sparkles />
        Autofill
      </Button>
    ) : undefined;

  return (
    <PageShell
      variant="form"
      title="Create Change Event"
      description="Document a potential change to project scope, schedule, or budget."
      onBack={handleCancel}
      actions={headerActions}
    >
      <FormContainer maxWidth="xl" withCard={false}>
        <ChangeEventForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSaving}
          mode="create"
          projectId={projectId}
        />
      </FormContainer>
    </PageShell>
  );
}
