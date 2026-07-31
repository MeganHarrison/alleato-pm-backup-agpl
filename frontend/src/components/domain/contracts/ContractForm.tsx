"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { FormContainer } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { Button } from "@/components/ui/button";
import { isDevelopment } from "@/lib/dev-autofill";
import {
  PrimeContractDatesSection,
  PrimeContractGeneralInfoSection,
  PrimeContractPrivacySection,
  PrimeContractScopeSection,
} from "@/components/domain/contracts/prime-contract-form/sections";
import type { ContractFormData } from "@/components/domain/contracts/prime-contract-form/types";
import {
  PrimeContractCreateBudgetCodeModal,
  PrimeContractSovSection,
} from "@/components/domain/contracts/prime-contract-form/sov";
import { FinancialMarkupFormSection } from "@/components/domain/contracts/prime-contract-form/financial-markup-form-section";
import { usePrimeContractFormState } from "@/components/domain/contracts/prime-contract-form/usePrimeContractFormState";

// ============================================================================
// Types
// ============================================================================

export type {
  ContractFormData,
  SOVLineItem,
} from "@/components/domain/contracts/prime-contract-form/types";

interface ContractFormProps {
  initialData?: Partial<ContractFormData>;
  onSubmit: (data: ContractFormData, attachmentFiles?: File[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  projectId: string;
}

// ============================================================================
// Constants
// ============================================================================

const CONTRACT_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "out_for_signature", label: "Out for Signature" },
  { value: "approved", label: "Approved" },
  { value: "complete", label: "Complete" },
  { value: "terminated", label: "Terminated" },
];

// ============================================================================
// Main Component
// ============================================================================

export function ContractForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  mode = "create",
  projectId,
}: ContractFormProps) {
  const {
    form,
    submitHandler,
    formData,
    budgetCodes,
    loadingBudgetCodes,
    showCreateBudgetCodeModal,
    newBudgetCodeData,
    availableCostCodes,
    loadingCostCodes,
    expandedDivisions,
    groupedCostCodes,
    showImportFromBudget,
    showImportEstimateWorkbook,
    companyOptions,
    companiesLoading,
    userOptions,
    isCreating,
    isUnitQuantityMode,
    sovColumnCount,
    sovTotals,
    getCostTypeLabel,
    toggleDivision,
    handleCreateBudgetCode,
    handleBudgetCodeSelect,
    addSOVLine,
    updateSOVLine,
    removeSOVLine,
    reorderSovLine,
    selectedSovItems,
    toggleSovItemSelection,
    toggleAllSovItems,
    bulkRemoveSovLines,
    toggleSovAccountingMethod,
    handleImportFromBudgetSuccess,
    handleImportEstimateWorkbookSuccess,
    handleAttachmentListChange,
    handleFilesSelected,
    handleAutoFill,
    setShowCreateBudgetCodeModal,
    setNewBudgetCodeData,
    setShowImportFromBudget,
    setShowImportEstimateWorkbook,
    fetchBudgetCodes,
    markups,
    setMarkups,
    sovDisplayItems,
  } = usePrimeContractFormState({
    initialData,
    projectId,
    mode,
    onSubmit,
  });

  return (
    <FormContainer maxWidth="lg" withCard={false}>
      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(submitHandler)}
          className="space-y-8"
          data-testid="prime-contract-form"
          data-dev-autofill-disabled
        >
          <PrimeContractGeneralInfoSection
            control={form.control}
            companyOptions={companyOptions}
            companiesLoading={companiesLoading}
            contractStatuses={CONTRACT_STATUSES}
            attachments={mode === "create" ? formData.attachments || [] : undefined}
            isSubmitting={isSubmitting}
            onAttachmentChange={
              mode === "create" ? handleAttachmentListChange : undefined
            }
            onFilesSelected={mode === "create" ? handleFilesSelected : undefined}
          />

          <PrimeContractDatesSection control={form.control} />

          <FinancialMarkupFormSection
            markups={markups}
            budgetCodes={budgetCodes}
            onChange={setMarkups}
          />

          <PrimeContractSovSection
            projectId={projectId}
            formData={{ ...formData, sovItems: sovDisplayItems } as Partial<ContractFormData>}
            budgetCodes={budgetCodes}
            loadingBudgetCodes={loadingBudgetCodes}
            showImportFromBudget={showImportFromBudget}
            showImportEstimateWorkbook={showImportEstimateWorkbook}
            sovColumnCount={sovColumnCount}
            isUnitQuantityMode={isUnitQuantityMode}
            sovTotals={sovTotals}
            onShowImportFromBudgetChange={setShowImportFromBudget}
            onShowImportEstimateWorkbookChange={setShowImportEstimateWorkbook}
            onShowCreateBudgetCodeModal={() => setShowCreateBudgetCodeModal(true)}
            onToggleSovAccountingMethod={toggleSovAccountingMethod}
            onAddSovLine={addSOVLine}
            onUpdateSovLine={updateSOVLine}
            onRemoveSovLine={removeSOVLine}
            onReorderSovLine={reorderSovLine}
            selectedSovItems={selectedSovItems}
            onToggleSovItemSelection={toggleSovItemSelection}
            onToggleAllSovItems={toggleAllSovItems}
            onBulkRemoveSovLines={bulkRemoveSovLines}
            onHandleBudgetCodeSelect={handleBudgetCodeSelect}
            onHandleImportFromBudgetSuccess={handleImportFromBudgetSuccess}
            onHandleImportEstimateWorkbookSuccess={
              handleImportEstimateWorkbookSuccess
            }
            onBudgetCodesActivated={fetchBudgetCodes}
          />

          <PrimeContractScopeSection control={form.control} />

          <PrimeContractPrivacySection
            control={form.control}
            userOptions={userOptions}
          />

          <FormServerError message={form.formState.errors.root?.message} />

          <FormActions
            onCancel={onCancel}
            isSubmitting={isSubmitting}
            submitLabel={
              mode === "create" ? "Create Prime Contract" : "Save Changes"
            }
            stickyOnMobile
          >
            {isDevelopment ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleAutoFill}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Auto-fill
              </Button>
            ) : null}
          </FormActions>
        </form>
      </Form>

      <PrimeContractCreateBudgetCodeModal
        open={showCreateBudgetCodeModal}
        loadingCostCodes={loadingCostCodes}
        groupedCostCodes={groupedCostCodes}
        expandedDivisions={expandedDivisions}
        availableCostCodes={availableCostCodes}
        newBudgetCodeData={newBudgetCodeData}
        isCreating={isCreating}
        getCostTypeLabel={getCostTypeLabel}
        onOpenChange={setShowCreateBudgetCodeModal}
        onToggleDivision={toggleDivision}
        onNewBudgetCodeDataChange={setNewBudgetCodeData}
        onCreate={handleCreateBudgetCode}
      />
    </FormContainer>
  );
}
