"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, apiFetchWithTimeout } from "@/lib/api-client";
import { fetchWithTransientRouteRetry } from "@/lib/fetch-with-transient-route-retry";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type { ContractFormData } from "@/components/domain/contracts/ContractForm";
import type { PrimeContractCreationReceipt } from "@/lib/prime-contracts/create-prime-contract";

const SUBMIT_TIMEOUT_MS = 20_000;

export function useCreatePrimeContract(projectId: string) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const warmContractDetailSurface = async (contractId: string) => {
    router.prefetch(`/${projectId}/prime-contracts/${contractId}`);
    await Promise.allSettled([
      fetchWithTransientRouteRetry(`/api/projects/${projectId}/contracts/settings`),
      fetchWithTransientRouteRetry(`/api/projects/${projectId}/contracts/${contractId}`),
      fetchWithTransientRouteRetry(`/api/projects/${projectId}/contracts/${contractId}/line-items`),
    ]);
  };

  const uploadAttachments = async (contractId: string, files: File[]) => {
    const errors: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        await apiFetch(`/api/projects/${projectId}/contracts/${contractId}/attachments`, {
          method: "POST",
          body: formData,
        });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "Unknown upload error"}`);
      }
    }
    return errors;
  };

  const handleSubmit = async (data: ContractFormData, attachmentFiles: File[] = []) => {
    setIsSubmitting(true);
    let createdContractId: string | null = null;

    try {
      const sovItems = (data.sovItems || []).filter((item) => !item.isGroup);
      const sovTotal = sovItems.reduce(
        (sum, item) =>
          sum +
          (data.accountingMethod === "unit_quantity" && !item.isMarkup
            ? (item.quantity ?? 0) * (item.unitCost ?? 0)
            : item.amount || 0),
        0,
      );

      const lineItems = sovItems.map((item, index) => ({
        line_number: index + 1,
        description: item.description || `Line ${index + 1}`,
        budget_code_id: item.isMarkup
          ? null
          : item.budgetCodeId || null,
        quantity:
          data.accountingMethod === "unit_quantity" && !item.isMarkup
            ? item.quantity ?? 0
            : 1,
        unit_cost:
          data.accountingMethod === "unit_quantity" && !item.isMarkup
            ? item.unitCost ?? 0
            : item.amount || 0,
        unit_of_measure: item.unitOfMeasure || null,
        markup_type: item.isMarkup ? item.markupType ?? null : null,
      }));

      const newContract = await apiFetchWithTimeout<{
        id: string;
        creation_receipt?: PrimeContractCreationReceipt;
      }>(
        `/api/projects/${projectId}/contracts`,
        {
          method: "POST",
          body: JSON.stringify({
            contract_number: data.number,
            title: data.title,
            client_id: data.ownerCompanyId || null,
            contract_company_id: data.ownerCompanyId || data.contractCompanyId || null,
            contractor_id: data.contractorId || null,
            architect_engineer_id: data.architectEngineerId || null,
            description: data.description,
            status: data.status || "draft",
            executed: data.executed || false,
            executed_at: data.executed ? new Date().toISOString() : null,
            original_contract_value: sovTotal,
            revised_contract_value: sovTotal,
            start_date: data.startDate?.toISOString().split("T")[0] || null,
            end_date: data.estimatedCompletionDate?.toISOString().split("T")[0] || null,
            substantial_completion_date: data.substantialCompletionDate?.toISOString().split("T")[0] || null,
            actual_completion_date: data.actualCompletionDate?.toISOString().split("T")[0] || null,
            signed_contract_received_date: data.signedContractReceivedDate?.toISOString().split("T")[0] || null,
            contract_termination_date: data.contractTerminationDate?.toISOString().split("T")[0] || null,
            retention_percentage: data.defaultRetainage || 0,
            payment_terms: data.paymentTerms || null,
            billing_schedule: data.billingSchedule || null,
            is_private: data.isPrivate || false,
            inclusions: data.inclusions || null,
            exclusions: data.exclusions || null,
            allowed_user_ids: data.allowedUsers && data.allowedUsers.length > 0 ? data.allowedUsers : [],
            allow_sov_view: data.allowedUsersCanSeeSov || false,
            line_items: lineItems,
          }),
        },
        SUBMIT_TIMEOUT_MS,
      );

      createdContractId = newContract.id;

      const attachmentErrors = attachmentFiles.length > 0
        ? await uploadAttachments(newContract.id, attachmentFiles)
        : [];

      const sovErrors =
        newContract.creation_receipt?.lineItems.failed.map(
          (failure) =>
            `Line ${failure.lineNumber} (${failure.description}): ${failure.message}`,
        ) ?? [];

      // Save markups that don't yet exist in the DB (temp IDs start with "markup-")
      const newMarkups = (data.markups || []).filter((m) =>
        m.id.startsWith("markup-"),
      );
      for (const markup of newMarkups) {
        try {
          await apiFetch(`/api/projects/${projectId}/vertical-markup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              markup_type: markup.markup_type,
              percentage: markup.percentage,
              compound: markup.compound,
              maps_to_budget_code_id: markup.maps_to !== "all" ? markup.maps_to : null,
            }),
          });
        } catch {
          // Non-critical: markups can be configured later in the Financial Markup tab
        }
      }

      // Detail warm-up is a performance optimization, not a prerequisite for
      // completing the create flow. Waiting here can strand a successfully
      // created contract on the form when any optional warm-up request stalls.
      void warmContractDetailSurface(newContract.id).catch((error) => {
        reportNonCriticalFailure({
          area: "prime-contract-create",
          operation: "warm-contract-detail-surface",
          error,
          userVisibleFallback:
            "Prime contract was created; detail data may finish loading shortly.",
          metadata: { projectId, contractId: newContract.id },
        });
      });

      const failedParts = [
        sovErrors.length > 0 ? `${sovErrors.length} line item${sovErrors.length !== 1 ? "s" : ""}` : null,
        attachmentErrors.length > 0 ? `${attachmentErrors.length} attachment${attachmentErrors.length !== 1 ? "s" : ""}` : null,
      ].filter(Boolean);

      if (failedParts.length > 0) {
        toast.warning(
          `Contract created, but ${failedParts.join(" and ")} failed to save. You can finish cleanup from the contract page.`,
          { duration: 8000 },
        );
      } else {
        toast.success("Prime contract created");
      }

      router.push(`/${projectId}/prime-contracts/${newContract.id}`);
    } catch (err) {
      if (createdContractId) {
        toast.warning(
          "Contract was saved, but an unexpected error occurred. Redirecting to the contract page.",
          { duration: 8000 },
        );
        void warmContractDetailSurface(createdContractId).catch((error) => {
          reportNonCriticalFailure({
            area: "prime-contract-create",
            operation: "warm-contract-detail-after-create-recovery",
            error,
            userVisibleFallback:
              "Prime contract was created; detail data may finish loading shortly.",
            metadata: { projectId, contractId: createdContractId },
          });
        });
        router.push(`/${projectId}/prime-contracts/${createdContractId}`);
        return;
      }

      // "Failed to fetch" may mean the INSERT committed before the connection dropped.
      // Check if the contract was actually saved before showing an error.
      if (err instanceof TypeError && err.message.toLowerCase().includes("failed to fetch")) {
        try {
          const contracts = await apiFetch<Array<{ contract_number: string; id: string }>>(
            `/api/projects/${projectId}/contracts?search=${encodeURIComponent(data.number)}`,
          );
          const saved = Array.isArray(contracts)
            ? contracts.find((c) => c.contract_number === data.number)
            : null;
          if (saved) {
            void warmContractDetailSurface(saved.id);
            toast.success("Prime contract created");
            router.push(`/${projectId}/prime-contracts/${saved.id}`);
            return;
          }
        } catch (recoveryError) {
          reportNonCriticalFailure({
            area: "prime-contract-create",
            operation: "verify-save-after-network-error",
            error: recoveryError,
            userVisibleFallback:
              "Prime contract creation could not be verified after a network failure.",
            metadata: { projectId, contractNumber: data.number },
          });
        }
      }

      toast.error("Failed to create contract");
    } finally {
      setIsSubmitting(false);
    }
  };

  return { handleSubmit, isSubmitting };
}
