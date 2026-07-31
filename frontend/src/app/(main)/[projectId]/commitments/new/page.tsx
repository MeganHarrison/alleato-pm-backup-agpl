"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  CreatePurchaseOrderForm,
  CreateSubcontractForm,
} from "@/components/domain/contracts";
import { apiFetch, apiFetchRaw } from "@/lib/api-client";
import { uploadEntityAttachment } from "@/lib/documents/upload-entity-attachment";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";
import { PageShell } from "@/components/layout";
import type { CreatePurchaseOrderInput } from "@/lib/schemas/create-purchase-order-schema";
import type { CreateSubcontractInput } from "@/lib/schemas/create-subcontract-schema";

export default function NewCommitmentPage() {
  const router = useRouter();
  const params = useParams()!;
  const searchParams = useSearchParams()!;
  const projectId = Number(params.projectId);
  const type = searchParams.get("type") || "subcontract"; // 'subcontract' or 'purchase_order'

  // Pre-fill data passed from SubList award flow
  const prefillVendorId = searchParams.get("vendor_id") ?? undefined;
  const prefillTitle = searchParams.get("title") ?? undefined;
  const prefillAmount = searchParams.get("amount") ? Number(searchParams.get("amount")) : undefined;
  const prefillDescription = searchParams.get("description") ?? undefined;

  const subcontractInitialData =
    prefillVendorId || prefillTitle
      ? {
          contractCompanyId: prefillVendorId ?? "",
          title: prefillTitle ?? "",
          description: prefillDescription ?? "",
          status: "Draft" as const,
          ...(prefillAmount && prefillTitle
            ? {
                sovLines: [
                  {
                    lineNumber: undefined,
                    changeEventLineItem: undefined,
                    budgetCode: undefined,
                    budgetCodeId: undefined,
                    budgetCodeLabel: undefined,
                    description: prefillTitle,
                    amount: prefillAmount,
                    quantity: undefined,
                    unitCost: undefined,
                    unitOfMeasure: undefined,
                    billedToDate: undefined,
                    isGroup: undefined,
                  },
                ],
              }
            : {}),
        }
      : undefined;

  const parseApiError = async (response: Response) => {
    const rawBody = await response.text();
    const fallbackError = `Request failed with status ${response.status}`;

    try {
      const json = rawBody ? JSON.parse(rawBody) : null;
      return {
        error:
          typeof json?.error === "string"
            ? json.error
            : rawBody.trim() || fallbackError,
        details: json?.details,
      };
    } catch {
      return {
        error: rawBody.trim() || fallbackError,
        details: undefined,
      };
    }
  };

  const formatApiErrorMessage = (error: string, details: unknown) => {
    if (!details || typeof details !== "object") return error;

    const detailsRecord = details as Record<string, unknown>;
    const detailMessage =
      (typeof detailsRecord.message === "string" && detailsRecord.message) ||
      (typeof detailsRecord.hint === "string" && detailsRecord.hint) ||
      (typeof detailsRecord.code === "string" && detailsRecord.code);

    if (!detailMessage) return error;
    return `${error}: ${detailMessage}`;
  };

  const isNetworkFetchError = (error: unknown): error is TypeError =>
    error instanceof TypeError &&
    error.message.toLowerCase().includes("failed to fetch");

  const findCommitmentByNumber = async (
    commitmentType: "subcontract" | "purchase_order",
    contractNumber: string,
  ): Promise<{ id?: string } | null> => {
    try {
      const endpoint =
        commitmentType === "subcontract"
          ? `/api/projects/${projectId}/subcontracts`
          : `/api/projects/${projectId}/purchase-orders`;
      const payload = await apiFetch<
        | { data?: Array<{ id?: string; contract_number?: string }> }
        | Array<{ id?: string; contract_number?: string }>
      >(endpoint);

      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.data)
          ? payload.data
          : [];

      return (
        rows.find((row) => row.contract_number === contractNumber) ?? null
      );
    } catch {
      return null;
    }
  };

  const uploadCommitmentAttachments = async (
    commitmentId: string,
    files: File[],
  ) => {
    if (!files.length) return;

    await Promise.all(
      files.map((file) =>
        uploadEntityAttachment({
          file,
          entityType: "commitment",
          entityId: commitmentId,
          projectId,
        }),
      ),
    );
  };

  const handleSubmitSubcontract = async (
    data: CreateSubcontractInput,
    attachmentFiles: File[] = [],
  ) => {
    console.warn(
      "[New Commitment Page] Starting subcontract submission for project:",
      projectId,
    );
    console.warn(
      "[New Commitment Page] Payload:",
      JSON.stringify(data, null, 2),
    );

    try {
      const response = await apiFetchRaw(`/api/projects/${projectId}/subcontracts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const responseData = await parseApiError(response);
        // Create a detailed error with response info
        const errorMessage = responseData.error || "Failed to create subcontract";
        const detailedError = new Error(errorMessage) as Error & {
          details?: unknown;
          status?: number;
        };
        detailedError.details = responseData.details;
        detailedError.status = response.status;
        console.error("[New Commitment Page] Submission failed:", {
          status: response.status,
          error: errorMessage,
          details: responseData.details,
        });
        throw detailedError;
      }

      const responseData = (await response.json()) as {
        data?: { id?: string };
      };
      console.warn("[New Commitment Page] Response status:", response.status);
      console.warn(
        "[New Commitment Page] Subcontract created successfully:",
        responseData.data,
      );

      const createdCommitmentId = responseData?.data?.id;
      if (createdCommitmentId && attachmentFiles.length > 0) {
        await uploadCommitmentAttachments(createdCommitmentId, attachmentFiles);
      }

      // Navigate back to commitments page
      router.push(`/${projectId}/commitments`);
    } catch (error) {
      // "Failed to fetch" often means the dev server request dropped during HMR
      // while the insert still completed. Verify by contract number.
      if (isNetworkFetchError(error)) {
        const recovered = await findCommitmentByNumber(
          "subcontract",
          data.contractNumber,
        );
        if (recovered?.id) {
          if (attachmentFiles.length > 0) {
            await uploadCommitmentAttachments(recovered.id, attachmentFiles);
          }
          router.push(`/${projectId}/commitments`);
          return;
        }
      }
      throw error;
    }
  };

  const handleSubmitPurchaseOrder = async (data: CreatePurchaseOrderInput) => {
    console.warn(
      "[New Commitment Page] Starting purchase order submission for project:",
      projectId,
    );
    console.warn(
      "[New Commitment Page] Payload:",
      JSON.stringify(data, null, 2),
    );

    try {
      const response = await apiFetchRaw(`/api/projects/${projectId}/purchase-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const responseData = await parseApiError(response);
        const errorMessage = formatApiErrorMessage(
          responseData.error || "Failed to create purchase order",
          responseData.details,
        );
        const detailedError = new Error(errorMessage) as Error & {
          details?: unknown;
          status?: number;
        };
        detailedError.details = responseData.details;
        detailedError.status = response.status;
        console.error("[New Commitment Page] PO submission failed", response.status, errorMessage, responseData.details);
        throw detailedError;
      }

      router.push(`/${projectId}/commitments`);
    } catch (error) {
      // "Failed to fetch" often means the dev server request dropped during HMR
      // while the insert still completed. Verify by contract number.
      if (isNetworkFetchError(error)) {
        const recovered = await findCommitmentByNumber(
          "purchase_order",
          data.contractNumber,
        );
        if (recovered?.id) {
          router.push(`/${projectId}/commitments`);
          return;
        }
      }
      throw error;
    }
  };

  const handleCancel = () => {
    router.push(`/${projectId}/commitments`);
  };

  const title =
    type === "subcontract"
      ? "New Subcontract"
      : type === "purchase_order"
        ? "New Purchase Order"
        : "New Commitment";

  if (type === "purchase_order") {
    return (
      <PageShell
        variant="detail"
        title={title}
        description="Create a new purchase order commitment"
        onBack={() => router.back()}
        actions={<CommitmentsHelpSheet buttonVariant="ghost" />}
      >
        <CreatePurchaseOrderForm
          projectId={projectId}
          onSubmit={handleSubmitPurchaseOrder}
          onCancel={handleCancel}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title={title}
      description="Create a new subcontract commitment"
      onBack={() => router.back()}
      backLabel="Back to Commitments"
    >
      <CreateSubcontractForm
        projectId={projectId}
        onSubmit={handleSubmitSubcontract}
        onCancel={handleCancel}
        initialData={subcontractInitialData}
      />
    </PageShell>
  );
}
