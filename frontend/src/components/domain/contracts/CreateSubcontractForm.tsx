"use client";

import * as React from "react";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { FormContainer } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormSection } from "@/components/forms/FormSection";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import type {
  CreateSubcontractInput,
  SovLineItem,
} from "@/lib/schemas/create-subcontract-schema";
import {
  ContractDatesSection,
  CreateBudgetCodeModal,
  GeneralInfoSection,
  InclusionsExclusionsSection,
  InvoiceContactsSection,
  PrivacySection,
  SovSection,
} from "./subcontract-form";
import { useSubcontractFormState } from "./subcontract-form/useSubcontractFormState";

interface CreateSubcontractFormProps {
  projectId: number;
  onSubmit: (data: CreateSubcontractInput, attachmentFiles?: File[]) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CreateSubcontractInput> & {
    sovLines?: SovLineItem[];
  };
  mode?: "create" | "edit";
}

export function CreateSubcontractForm({
  projectId,
  onSubmit,
  onCancel,
  initialData,
  mode = "create",
}: CreateSubcontractFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showCreateBudgetCodeModal, setShowCreateBudgetCodeModal] =
    React.useState(false);

  const {
    methods,
    sovLines,
    setSovLines,
    attachments,
    pendingAttachmentFiles,
    budgetCodes,
    setBudgetCodes,
    loadingBudgetCodes,
    vendorOptions,
    isLoadingVendors,
    accountingMethod,
    toggleAccountingMethod,
    userOptions,
    isLoadingUsers,
    invoiceContactOptions,
    isLoadingContacts,
    refetchContacts,
    vendorId,
    vendorCompanyId,
    handleAttachmentListChange,
    handleFilesSelected,
  } = useSubcontractFormState({ projectId, initialData, mode: mode ?? "create" });

  const {
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = methods;

  const handleFormSubmit = async (data: CreateSubcontractInput) => {
    setIsSubmitting(true);
    clearErrors("root");
    try {
      await onSubmit(
        {
          ...data,
          sov: sovLines,
          attachments: attachments.map((a) => ({
            name: a.name,
            size: a.size,
            type: a.type,
          })),
        },
        pendingAttachmentFiles,
      );
    } catch (err) {
      setError("root", {
        type: "server",
        message:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormContainer maxWidth="lg" withCard={false}>
      <Form {...methods}>
        <form
          noValidate
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-8"
        >
          <GeneralInfoSection
            isSubmitting={isSubmitting}
            vendorOptions={vendorOptions}
            isLoadingVendors={isLoadingVendors}
          />

          <InclusionsExclusionsSection isSubmitting={isSubmitting} />

          <ContractDatesSection isSubmitting={isSubmitting} />

          <FormSection title="Attachments">
            <FileUploadField
              value={attachments}
              onChange={handleAttachmentListChange}
              onFilesSelected={handleFilesSelected}
              multiple
              maxFiles={20}
              maxSize={50 * 1024 * 1024}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              disabled={isSubmitting}
            />
          </FormSection>

          <SovSection
            sovLines={sovLines}
            onSovLinesChange={setSovLines}
            accountingMethod={accountingMethod}
            onToggleAccountingMethod={toggleAccountingMethod}
            budgetCodes={budgetCodes}
            loadingBudgetCodes={loadingBudgetCodes}
            onCreateBudgetCode={() => setShowCreateBudgetCodeModal(true)}
            isSubmitting={isSubmitting}
          />

          <PrivacySection
            isSubmitting={isSubmitting}
            userOptions={userOptions}
            isLoadingUsers={isLoadingUsers}
          />

          <InvoiceContactsSection
            isSubmitting={isSubmitting}
            invoiceContactOptions={invoiceContactOptions}
            isLoadingContacts={isLoadingContacts}
            vendorId={vendorId}
            vendorCompanyId={vendorCompanyId}
            refetchContacts={refetchContacts}
          />

          <FormServerError message={errors.root?.message} />

          <FormActions
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            submitLabel={mode === "edit" ? "Save Changes" : "Create Subcontract"}
            stickyOnMobile
          />

          <CreateBudgetCodeModal
            open={showCreateBudgetCodeModal}
            onOpenChange={setShowCreateBudgetCodeModal}
            projectId={projectId}
            budgetCodes={budgetCodes}
            onBudgetCodeCreated={(bc) =>
              setBudgetCodes((prev) => [...prev, bc])
            }
            sovLines={sovLines}
            accountingMethod={accountingMethod}
            onSovLinesChange={setSovLines}
          />
        </form>
      </Form>
    </FormContainer>
  );
}
