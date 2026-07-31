"use client";

import * as React from "react";

import { Form } from "@/components/ui/form";
import { FileUploadField, FormSection } from "@/components/forms";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { CreateBudgetCodeModal } from "@/app/(main)/[projectId]/budget/setup/components/CreateBudgetCodeModal";

import {
  GeneralInfoSection,
  LineItemsSection,
  useChangeEventFormData,
} from "./change-event-form";

import type { ChangeEventFormData, ChangeEventFormProps } from "./change-event-form";

// Re-export types for backwards compatibility
export type { ChangeEventFormData, ChangeEventLineItem } from "./change-event-form";

export function ChangeEventForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = "create",
  projectId,
}: ChangeEventFormProps) {
  const {
    form,
    lineItemFields,
    nextNumber,
    updateLineItem,
    vendors,
    contracts,
    budgetCodes,
    primeContractOptions,
    primeContractSelectOptions,
    commitmentLineItemsMap,
    showCreateBudgetCodeModal,
    setShowCreateBudgetCodeModal,
    setTargetBudgetCodeRowIndex,
    handleCommitmentChange,
    handleCommitmentLineItemChange,
    handleAddAllCommitmentLineItems,
    addLineItem,
    removeLineItem,
    csvInputRef,
    handleCsvImport,
    handleBudgetCodeCreated,
  } = useChangeEventFormData({ initialData, projectId });

  const expectingRevenue = form.watch("expectingRevenue") !== false;
  const lineItemRevenueSource = form.watch("lineItemRevenueSource");
  const attachments = form.watch("attachments");

  const attachmentsAsInfo = React.useMemo(
    () =>
      attachments.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    [attachments],
  );

  const setAttachments = React.useCallback(
    (updater: (prev: File[]) => File[]) => {
      form.setValue("attachments", updater(form.getValues("attachments")), {
        shouldDirty: true,
      });
    },
    [form],
  );

  const handleSubmit = form.handleSubmit(
    async (data) => {
      // Route-level failures surface via FormServerError (errors.root). The
      // page's onSubmit throws on failure so the message lands here.
      try {
        await onSubmit(data);
      } catch (error) {
        form.setError("root", {
          type: "server",
          message:
            error instanceof Error ? error.message : "Failed to save change event",
        });
      }
    },
    () => {
      // Scroll to the first invalid field so validation errors aren't hidden
      // below the fold.
      requestAnimationFrame(() => {
        const firstError = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    },
  );

  return (
    <>
      <Form {...form}>
        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-8"
          data-dev-autofill-disabled="true"
          data-form-id="change-event-create"
        >
          <GeneralInfoSection
            form={form}
            nextNumber={nextNumber}
            primeContractSelectOptions={primeContractSelectOptions}
            hasPrimeContracts={primeContractOptions.length > 0}
            projectId={projectId}
          />

          <LineItemsSection
            control={form.control}
            fields={lineItemFields}
            updateLineItem={updateLineItem}
            addLineItem={addLineItem}
            removeLineItem={removeLineItem}
            vendors={vendors}
            contracts={contracts}
            budgetCodes={budgetCodes}
            commitmentLineItemsMap={commitmentLineItemsMap}
            onCreateBudgetCode={(rowIndex) => {
              setTargetBudgetCodeRowIndex(rowIndex);
              setShowCreateBudgetCodeModal(true);
            }}
            handleCommitmentChange={handleCommitmentChange}
            handleCommitmentLineItemChange={handleCommitmentLineItemChange}
            expectingRevenue={expectingRevenue}
            csvInputRef={csvInputRef}
            handleCsvImport={handleCsvImport}
            handleAddAllCommitmentLineItems={handleAddAllCommitmentLineItems}
            lineItemRevenueSource={lineItemRevenueSource}
          />

          <FormSection title="Attachments">
            <div className="max-w-3xl">
              <FileUploadField
                value={attachmentsAsInfo}
                multiple
                variant="minimal"
                onFilesSelected={(files) => {
                  setAttachments((prev) => [...prev, ...files]);
                }}
                onChange={(nextFiles) => {
                  const remaining = nextFiles.map(
                    (f) => `${f.name}:${f.size}:${f.type || ""}`,
                  );
                  setAttachments((prev) =>
                    prev.filter((file) =>
                      remaining.includes(`${file.name}:${file.size}:${file.type || ""}`),
                    ),
                  );
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.heic,.csv"
                maxSize={25 * 1024 * 1024}
              />
            </div>
          </FormSection>

          <FormServerError message={form.formState.errors.root?.message} />

          <FormActions
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            submitLabel={mode === "create" ? "Create Change Event" : "Update Change Event"}
            submitDataTestId={mode === "create" ? "change-event-create-submit" : "change-event-update-submit"}
            stickyOnMobile
          />
        </form>
      </Form>

      <CreateBudgetCodeModal
        open={showCreateBudgetCodeModal}
        onOpenChange={(open) => {
          setShowCreateBudgetCodeModal(open);
          if (!open) {
            setTargetBudgetCodeRowIndex(null);
          }
        }}
        projectId={String(projectId)}
        onSuccess={handleBudgetCodeCreated}
      />
    </>
  );
}
