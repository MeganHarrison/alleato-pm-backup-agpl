"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  CreatePurchaseOrderForm,
  CreateSubcontractForm,
} from "@/components/domain/contracts";
import { apiFetch } from "@/lib/api-client";
import { uploadEntityAttachment } from "@/lib/documents/upload-entity-attachment";
import { PageShell } from "@/components/layout";
import { CommitmentsHelpSheet } from "@/components/commitments/CommitmentsHelpSheet";
import { ErrorState } from "@/components/ds";
import { Skeleton } from "@/components/ui/skeleton";
import { commitmentKeys, useCommitmentDetail } from "@/hooks/use-commitments-query";
import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";
import type { CreateSubcontractInput, SovLineItem } from "@/lib/schemas/create-subcontract-schema";
import type { CreatePurchaseOrderInput, PurchaseOrderSovLineItem } from "@/lib/schemas/create-purchase-order-schema";

type SubcontractInitialData = Partial<CreateSubcontractInput> & { sovLines?: SovLineItem[] };
type PurchaseOrderInitialData = Partial<CreatePurchaseOrderInput> & {
  contractCompanyName?: string;
  assignedToName?: string;
  billToCompanyName?: string;
  billToContactName?: string;
  shipToCompanyName?: string;
  shipToContactName?: string;
  sovLines?: PurchaseOrderSovLineItem[];
};
type CommitmentAttachment = {
  fileName?: string;
  file_name?: string;
  name?: string;
  size?: number;
  fileSize?: number;
  type?: string;
  mimeType?: string;
};

export default function EditCommitmentPage() {
  const router = useRouter();
  const params = useParams()!;
  const queryClient = useQueryClient();
  const projectId = Number(params.projectId);
  const commitmentId = params.commitmentId as string;

  const { data: rawData, isLoading } = useCommitmentDetail(commitmentId);
  const { profile } = useCurrentUserProfile();
  const isAdmin = profile?.isAdmin ?? false;
  const [attachments, setAttachments] = useState<CommitmentAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchAttachments = async () => {
      try {
        setAttachmentsLoading(true);
        const linked = await apiFetch<
          Array<{
            document_metadata_id: string;
            title: string | null;
            file_name: string | null;
            source_size: number | null;
          }>
        >(
          `/api/document-picker/linked?entityType=commitment&entityId=${encodeURIComponent(commitmentId)}`,
        ).catch(() => null);
        if (isMounted) {
          setAttachments(
            (linked ?? []).map((doc) => ({
              fileName: doc.title ?? doc.file_name ?? "Attachment",
              fileSize: doc.source_size ?? 0,
            })),
          );
        }
      } catch {
        if (isMounted) setAttachments([]);
      } finally {
        if (isMounted) setAttachmentsLoading(false);
      }
    };

    if (commitmentId) {
      fetchAttachments();
    }

    return () => {
      isMounted = false;
    };
  }, [commitmentId]);

  const { isSubcontract, subcontractData, purchaseOrderData } = useMemo(() => {
    if (!rawData) return { isSubcontract: true, subcontractData: undefined, purchaseOrderData: undefined };

    const r = rawData as Record<string, unknown>;
    const isPO = r.type === "purchase_order";

    // Normalize API status (lowercase) to schema Title Case values
    const rawStatus = typeof r.status === "string" ? r.status : "draft";
    const statusKey = rawStatus.toLowerCase().replace(/_/g, " ");
    const statusMap: Record<string, CreateSubcontractInput["status"]> = {
      draft: "Draft",
      "out for bid": "Out for Bid",
      "out for signature": "Out for Signature",
      approved: "Approved",
      complete: "Complete",
      terminated: "Terminated",
    };
    const normalizedStatus: CreateSubcontractInput["status"] = statusMap[statusKey] ?? "Draft";

    const normalizedPurchaseOrderStatus: CreatePurchaseOrderInput["status"] = normalizedStatus;
    const normalizedSubcontractStatus: CreateSubcontractInput["status"] = normalizedStatus;

    // Map line items to SOV format
    const sovLines = Array.isArray(r.line_items)
      ? (r.line_items as Array<Record<string, unknown>>).map((item, idx) => ({
          lineNumber: typeof item.line_number === "number" ? item.line_number : idx + 1,
          budgetCode:
            typeof item.budget_code === "string" ? item.budget_code : undefined,
          budgetCodeId:
            typeof item.budget_code === "string" ? item.budget_code : undefined,
          budgetCodeLabel: undefined, // let reconciliation in useSubcontractFormState fill in the full label
          description: typeof item.description === "string" ? item.description : undefined,
          amount: typeof item.amount === "number" ? item.amount : 0,
          billedToDate: typeof item.billed_to_date === "number" ? item.billed_to_date : undefined,
        }))
      : [];

    if (isPO) {
      const rawAccountingMethod =
        typeof r.accounting_method === "string"
          ? r.accounting_method.toLowerCase()
          : "amount";
      const normalizedPurchaseOrderAccountingMethod:
        | "amount"
        | "unit-quantity" = rawAccountingMethod.includes("unit")
        ? "unit-quantity"
        : "amount";
      const companyObj = r.contract_company as
        | { id: string; name: string; license_number?: string | null }
        | null
        | undefined;
      const data: PurchaseOrderInitialData = {
        contractNumber: typeof r.contract_number === "string" ? r.contract_number : "",
        title: typeof r.title === "string" ? r.title : "",
        contractCompanyId: typeof r.contract_company_id === "string" ? r.contract_company_id : undefined,
        contractCompanyName: companyObj?.name,
        companyLicenseNumber: companyObj?.license_number ?? "",
        status: normalizedPurchaseOrderStatus,
        executed: typeof r.executed === "boolean" ? r.executed : false,
        accountingMethod: normalizedPurchaseOrderAccountingMethod,
        defaultRetainagePercent: typeof r.default_retainage_percent === "number" ? r.default_retainage_percent : undefined,
        description: typeof r.description === "string" ? r.description : undefined,
        billTo: typeof r.bill_to === "string" ? r.bill_to : undefined,
        shipTo: typeof r.ship_to === "string" ? r.ship_to : undefined,
        billToCompanyId: typeof r.bill_to_company_id === "string" ? r.bill_to_company_id : undefined,
        billToContactId: typeof r.bill_to_contact_id === "string" ? r.bill_to_contact_id : undefined,
        billToAddress: typeof r.bill_to_address === "string" ? r.bill_to_address : undefined,
        billToAddressLine2: typeof r.bill_to_address_line2 === "string" ? r.bill_to_address_line2 : undefined,
        billToCity: typeof r.bill_to_city === "string" ? r.bill_to_city : undefined,
        billToState: typeof r.bill_to_state === "string" ? r.bill_to_state : undefined,
        billToZip: typeof r.bill_to_zip === "string" ? r.bill_to_zip : undefined,
        billToCompanyName: (r.bill_to_company as { name?: string } | null)?.name,
        billToContactName: (r.bill_to_contact as { full_name?: string; name?: string } | null)?.full_name
          ?? (r.bill_to_contact as { name?: string } | null)?.name,
        shipToCompanyId: typeof r.ship_to_company_id === "string" ? r.ship_to_company_id : undefined,
        shipToContactId: typeof r.ship_to_contact_id === "string" ? r.ship_to_contact_id : undefined,
        shipToAddress: typeof r.ship_to_address === "string" ? r.ship_to_address : undefined,
        shipToAddressLine2: typeof r.ship_to_address_line2 === "string" ? r.ship_to_address_line2 : undefined,
        shipToCity: typeof r.ship_to_city === "string" ? r.ship_to_city : undefined,
        shipToState: typeof r.ship_to_state === "string" ? r.ship_to_state : undefined,
        shipToZip: typeof r.ship_to_zip === "string" ? r.ship_to_zip : undefined,
        shipToCompanyName: (r.ship_to_company as { name?: string } | null)?.name,
        shipToContactName: (r.ship_to_contact as { full_name?: string; name?: string } | null)?.full_name
          ?? (r.ship_to_contact as { name?: string } | null)?.name,
        shipVia: typeof r.ship_via === "string" ? r.ship_via : undefined,
        paymentTerms: typeof r.payment_terms === "string" ? r.payment_terms : undefined,
        dates: {
          contractDate: typeof r.contract_date === "string" ? r.contract_date : undefined,
          deliveryDate: typeof r.delivery_date === "string" ? r.delivery_date : undefined,
          signedPoReceivedDate: typeof r.signed_po_received_date === "string" ? r.signed_po_received_date : undefined,
          issuedOnDate: typeof r.issued_on_date === "string" ? r.issued_on_date : undefined,
        },
        assignedTo: typeof r.assigned_to === "string" ? r.assigned_to : undefined,
        assignedToName: typeof r.assigned_to_name === "string" ? r.assigned_to_name : undefined,
        invoiceContactIds: Array.isArray(r.invoice_contact_ids)
          ? (r.invoice_contact_ids as string[])
          : [],
        privacy: {
          isPrivate: typeof r.is_private === "boolean" ? r.is_private : true,
          allowNonAdminViewSovItems: typeof r.allow_non_admin_view_sov_items === "boolean" ? r.allow_non_admin_view_sov_items : false,
          nonAdminUserIds: Array.isArray(r.non_admin_user_ids)
            ? (r.non_admin_user_ids as string[])
            : [],
        },
        sovLines: sovLines as unknown as PurchaseOrderSovLineItem[],
      };
      return { isSubcontract: false, subcontractData: undefined, purchaseOrderData: data };
    }

    // Subcontract accounting method
    const rawMethod = typeof r.accounting_method === "string" ? r.accounting_method.toLowerCase() : "amount_based";
    const accountingMethod: "amount_based" | "unit_quantity" = rawMethod.includes("unit") ? "unit_quantity" : "amount_based";

    const data: SubcontractInitialData = {
      contractNumber: typeof r.contract_number === "string" ? r.contract_number : "",
      title: typeof r.title === "string" ? r.title : "",
      contractCompanyId: typeof r.contract_company_id === "string" ? r.contract_company_id : "",
      companyLicenseNumber:
        r.contract_company &&
        typeof r.contract_company === "object" &&
        "license_number" in r.contract_company &&
        typeof (r.contract_company as { license_number?: unknown }).license_number === "string"
          ? (r.contract_company as { license_number: string }).license_number
          : "",
      status: normalizedSubcontractStatus,
      executed: typeof r.executed === "boolean" ? r.executed : false,
      accountingMethod,
      defaultRetainagePercent: typeof r.default_retainage_percent === "number" ? r.default_retainage_percent : undefined,
      description: typeof r.description === "string" ? r.description : undefined,
      inclusions: typeof r.inclusions === "string" ? r.inclusions : undefined,
      exclusions: typeof r.exclusions === "string" ? r.exclusions : undefined,
      dates: {
        startDate: typeof r.start_date === "string" ? r.start_date : undefined,
        estimatedCompletionDate: typeof r.estimated_completion_date === "string" ? r.estimated_completion_date : undefined,
        actualCompletionDate:
          typeof r.actual_completion_date === "string"
            ? r.actual_completion_date
            : undefined,
        contractDate: typeof r.contract_date === "string" ? r.contract_date : undefined,
        signedContractReceivedDate: typeof r.signed_contract_received_date === "string" ? r.signed_contract_received_date : undefined,
        issuedOnDate:
          typeof r.issued_on_date === "string" ? r.issued_on_date : undefined,
      },
      privacy: {
        isPrivate: typeof r.is_private === "boolean" ? r.is_private : true,
        allowNonAdminViewSovItems: typeof r.allow_non_admin_view_sov_items === "boolean" ? r.allow_non_admin_view_sov_items : false,
        nonAdminUserIds: Array.isArray(r.non_admin_user_ids)
          ? (r.non_admin_user_ids as string[])
          : [],
      },
      invoiceContactIds: Array.isArray(r.invoice_contact_ids)
        ? (r.invoice_contact_ids as string[])
        : [],
      sovLines,
      attachments: attachments.map((attachment) => ({
        name:
          attachment.fileName ||
          attachment.file_name ||
          attachment.name ||
          "Attachment",
        size: attachment.fileSize ?? attachment.size ?? 0,
        type: attachment.mimeType ?? attachment.type ?? "",
      })),
    };
    return { isSubcontract: true, subcontractData: data, purchaseOrderData: undefined };
  }, [attachments, rawData]);

  const detailUrl = `/${projectId}/commitments/${commitmentId}`;
  const handleCancel = () => router.push(detailUrl);
  const normalizedStatus =
    rawData && typeof rawData === "object" && typeof (rawData as { status?: unknown }).status === "string"
      ? String((rawData as { status: string }).status).trim().toLowerCase()
      : "draft";
  // Approved commitments are locked to editors — except admins, who can always
  // edit (matches the detail-page inline-edit and Edit-menu admin bypass).
  const isApproved = normalizedStatus === "approved" && !isAdmin;

  const uploadCommitmentAttachments = async (
    targetCommitmentId: string,
    files: File[],
  ) => {
    if (!files.length) return;

    await Promise.all(
      files.map((file) =>
        uploadEntityAttachment({
          file,
          entityType: "commitment",
          entityId: targetCommitmentId,
          projectId,
        }),
      ),
    );
  };

  const NIL_UUID = "00000000-0000-0000-0000-000000000000";

  const handleSubmitSubcontract = async (
    data: CreateSubcontractInput,
    attachmentFiles: File[] = [],
  ) => {
    if (!commitmentId || commitmentId === NIL_UUID) {
      toast.error("Cannot save: commitment ID is not loaded yet. Please refresh and try again.");
      return;
    }
    await apiFetch(`/api/commitments/${commitmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_number: data.contractNumber,
        title: data.title,
        contract_company_id: data.contractCompanyId || null,
        company_license_number: data.companyLicenseNumber || null,
        status: data.status,
        description: data.description || null,
        inclusions: data.inclusions || null,
        exclusions: data.exclusions || null,
        is_private: data.privacy?.isPrivate ?? true,
        non_admin_user_ids: data.privacy?.nonAdminUserIds || [],
        allow_non_admin_view_sov_items: data.privacy?.allowNonAdminViewSovItems ?? false,
        start_date: data.dates?.startDate || null,
        estimated_completion_date: data.dates?.estimatedCompletionDate || null,
        actual_completion_date: data.dates?.actualCompletionDate || null,
        contract_date: data.dates?.contractDate || null,
        signed_contract_received_date:
          data.dates?.signedContractReceivedDate || null,
        issued_on_date: data.dates?.issuedOnDate || null,
        default_retainage_percent: data.defaultRetainagePercent ?? null,
        invoice_contact_ids: data.invoiceContactIds || [],
        sov_lines: (data.sov ?? []).map((line) => ({
          line_number: line.lineNumber,
          budget_code: line.budgetCode ?? null,
          description: line.description ?? null,
          amount: line.amount ?? 0,
        })),
      }),
    });

    if (attachmentFiles.length > 0) {
      await uploadCommitmentAttachments(commitmentId, attachmentFiles);
    }

    await queryClient.invalidateQueries({ queryKey: commitmentKeys.detail(commitmentId) });
    await queryClient.invalidateQueries({ queryKey: commitmentKeys.lists() });
    toast.success("Subcontract updated successfully");
    router.push(detailUrl);
  };

  const handleSubmitPurchaseOrder = async (data: CreatePurchaseOrderInput) => {
    if (!commitmentId || commitmentId === NIL_UUID) {
      toast.error("Cannot save: commitment ID is not loaded yet. Please refresh and try again.");
      return;
    }
    await apiFetch(`/api/commitments/${commitmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_number: data.contractNumber,
        title: data.title,
        contract_company_id: data.contractCompanyId || null,
        status: data.status,
        executed: data.executed ?? false,
        description: data.description || null,
        assigned_to: data.assignedTo || null,
        bill_to: data.billTo || null,
        ship_to: data.shipTo || null,
        bill_to_company_id: data.billToCompanyId || null,
        bill_to_contact_id: data.billToContactId || null,
        bill_to_address: data.billToAddress || null,
        bill_to_address_line2: data.billToAddressLine2 || null,
        bill_to_city: data.billToCity || null,
        bill_to_state: data.billToState || null,
        bill_to_zip: data.billToZip || null,
        ship_to_company_id: data.shipToCompanyId || null,
        ship_to_contact_id: data.shipToContactId || null,
        ship_to_address: data.shipToAddress || null,
        ship_to_address_line2: data.shipToAddressLine2 || null,
        ship_to_city: data.shipToCity || null,
        ship_to_state: data.shipToState || null,
        ship_to_zip: data.shipToZip || null,
        ship_via: data.shipVia || null,
        payment_terms: data.paymentTerms || null,
        is_private: data.privacy?.isPrivate ?? true,
        non_admin_user_ids: data.privacy?.nonAdminUserIds || [],
        allow_non_admin_view_sov_items: data.privacy?.allowNonAdminViewSovItems ?? false,
        invoice_contact_ids: data.invoiceContactIds || [],
        default_retainage_percent: data.defaultRetainagePercent ?? null,
        contract_date: data.dates?.contractDate || null,
        delivery_date: data.dates?.deliveryDate || null,
        signed_po_received_date: data.dates?.signedPoReceivedDate || null,
        issued_on_date: data.dates?.issuedOnDate || null,
      }),
    });

    await queryClient.invalidateQueries({ queryKey: commitmentKeys.detail(commitmentId) });
    await queryClient.invalidateQueries({ queryKey: commitmentKeys.lists() });
    toast.success("Purchase order updated successfully");
    router.push(detailUrl);
  };

  const title = isSubcontract ? "Edit Subcontract" : "Edit Purchase Order";

  if (isLoading || (isSubcontract && attachmentsLoading)) {
    return (
      <PageShell
        variant="detailWide"
        title={title}
        onBack={handleCancel}
        backLabel="Cancel"
        actions={<CommitmentsHelpSheet buttonVariant="ghost" />}
      >
        <div className="space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </PageShell>
    );
  }

  if (isApproved) {
    return (
      <PageShell
        variant="detailWide"
        title={title}
        onBack={handleCancel}
        backLabel="Back"
        actions={<CommitmentsHelpSheet buttonVariant="ghost" />}
      >
        <ErrorState
          title="Approved commitments cannot be edited"
          description="Change the commitment status back to Draft on the detail page before editing fields or line items."
        />
      </PageShell>
    );
  }

  if (!isSubcontract) {
    return (
      <PageShell
        variant="detailWide"
        title={title}
        onBack={handleCancel}
        backLabel="Cancel"
        actions={<CommitmentsHelpSheet buttonVariant="ghost" />}
      >
        <CreatePurchaseOrderForm
          projectId={projectId}
          onSubmit={handleSubmitPurchaseOrder}
          onCancel={handleCancel}
          initialData={purchaseOrderData}
          mode="edit"
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="detailWide"
      title={title}
      onBack={handleCancel}
      backLabel="Cancel"
      actions={<CommitmentsHelpSheet buttonVariant="ghost" />}
    >
      <CreateSubcontractForm
        projectId={projectId}
        onSubmit={handleSubmitSubcontract}
        onCancel={handleCancel}
        initialData={subcontractData}
        mode="edit"
      />
    </PageShell>
  );
}
