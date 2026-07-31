"use client";

import * as React from "react";
import { Controller, useWatch } from "react-hook-form";
import type { Control } from "react-hook-form";

import { FileUploadField } from "@/components/forms/FileUploadField";
import { FormGrid } from "@/components/forms";
import { FormSection } from "@/components/forms/FormSection";
import { RichTextField } from "@/components/forms/RichTextField";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFMultiComboboxField } from "@/components/forms/fields/RHFMultiComboboxField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";

import type { ContractFormData } from "./types";

export function PrimeContractGeneralInfoSection({
  control,
  companyOptions,
  companiesLoading,
  contractStatuses,
  ownerSelectedLabel,
  contractorSelectedLabel,
  architectEngineerSelectedLabel,
  attachments,
  isSubmitting,
  onAttachmentChange,
  onFilesSelected,
}: {
  control: Control<ContractFormData>;
  companyOptions: Array<{ value: string; label: string }>;
  companiesLoading: boolean;
  contractStatuses: Array<{ value: string; label: string }>;
  ownerSelectedLabel?: string;
  contractorSelectedLabel?: string;
  architectEngineerSelectedLabel?: string;
  attachments?: NonNullable<ContractFormData["attachments"]>;
  isSubmitting?: boolean;
  onAttachmentChange?: (
    nextFiles: NonNullable<ContractFormData["attachments"]>
  ) => void;
  onFilesSelected?: (files: File[]) => void;
}) {
  return (
    <FormSection title="General Information">
      <FormGrid columns={2}>
        <RHFTextField
          control={control}
          name="number"
          label="Contract # *"
          placeholder="Enter contract number"
        />
        <RHFComboboxField
          control={control}
          name="ownerCompanyId"
          label="Owner/Client"
          placeholder="Select company"
          searchPlaceholder="Search"
          emptyMessage="No matching company found."
          options={companyOptions}
          selectedLabel={ownerSelectedLabel}
          disabled={companiesLoading}
          clearable
        />
        <RHFTextField
          control={control}
          name="title"
          label="Title *"
          placeholder="Enter title"
        />
        <RHFSelectField
          control={control}
          name="status"
          label="Status"
          options={contractStatuses}
        />
        <RHFComboboxField
          control={control}
          name="contractorId"
          label="Contractor"
          placeholder="Select contractor"
          searchPlaceholder="Search"
          emptyMessage="No matching company found."
          options={companyOptions}
          selectedLabel={contractorSelectedLabel}
          disabled={companiesLoading}
          clearable
        />
        <RHFComboboxField
          control={control}
          name="architectEngineerId"
          label="Architect/Engineer"
          placeholder="Select architect/engineer"
          searchPlaceholder="Search"
          emptyMessage="No matching company found."
          options={companyOptions}
          selectedLabel={architectEngineerSelectedLabel}
          disabled={companiesLoading}
          clearable
        />
        <RHFNumberField
          control={control}
          name="defaultRetainage"
          label="Default Retainage (%)"
          min={0}
          max={100}
        />
        <RHFCheckboxField
          control={control}
          name="executed"
          label="Contract is executed"
        />
      </FormGrid>

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <RichTextField
            label="Description"
            value={field.value || ""}
            onChange={field.onChange}
            placeholder="Enter contract description..."
            fullWidth
          />
        )}
      />

      {attachments && onAttachmentChange && onFilesSelected ? (
        <FileUploadField
          label="Attachments"
          value={attachments}
          onChange={onAttachmentChange}
          onFilesSelected={onFilesSelected}
          multiple
          maxFiles={20}
          maxSize={50 * 1024 * 1024}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          disabled={isSubmitting}
          variant="minimal"
        />
      ) : null}
    </FormSection>
  );
}

export function PrimeContractDatesSection({
  control,
}: {
  control: Control<ContractFormData>;
}) {
  return (
    <FormSection title="Contract Dates">
      <FormGrid columns={2}>
        <RHFDateField
          control={control}
          name="startDate"
          label="Start Date"
          valueType="date"
          nullable
        />
        <RHFDateField
          control={control}
          name="estimatedCompletionDate"
          label="Estimated Completion Date"
          valueType="date"
          nullable
        />
        <RHFDateField
          control={control}
          name="substantialCompletionDate"
          label="Substantial Completion Date"
          description="Date when work is sufficiently complete for its intended use."
          valueType="date"
          nullable
        />
        <RHFDateField
          control={control}
          name="actualCompletionDate"
          label="Actual Completion Date"
          valueType="date"
          nullable
        />
        <RHFDateField
          control={control}
          name="signedContractReceivedDate"
          label="Signed Contract Received Date"
          valueType="date"
          nullable
        />
        <RHFDateField
          control={control}
          name="contractTerminationDate"
          label="Contract Termination Date"
          valueType="date"
          nullable
        />
      </FormGrid>
    </FormSection>
  );
}

export function PrimeContractScopeSection({
  control,
}: {
  control: Control<ContractFormData>;
}) {
  return (
    <FormSection title="Inclusions & Exclusions">
      <Controller
        control={control}
        name="inclusions"
        render={({ field }) => (
          <RichTextField
            label="Inclusions"
            value={field.value || ""}
            onChange={field.onChange}
            placeholder="Enter what is included in contract scope..."
            fullWidth
          />
        )}
      />
      <Controller
        control={control}
        name="exclusions"
        render={({ field }) => (
          <RichTextField
            label="Exclusions"
            value={field.value || ""}
            onChange={field.onChange}
            placeholder="Enter what is excluded from contract scope..."
            fullWidth
          />
        )}
      />
    </FormSection>
  );
}

export function PrimeContractPrivacySection({
  control,
  userOptions,
}: {
  control: Control<ContractFormData>;
  userOptions: Array<{ value: string; label: string }>;
}) {
  const isPrivate = useWatch({ control, name: "isPrivate" });

  return (
    <FormSection
      title="Contract Privacy"
      description="Using the privacy setting allows only project admins and select non-admin users access."
    >
      <RHFCheckboxField control={control} name="isPrivate" label="Private" />

      <RHFMultiComboboxField
        control={control}
        name="allowedUsers"
        label="Access for Non-Admin Users"
        options={userOptions}
        placeholder="Select project users"
        searchPlaceholder="Search project users..."
        emptyMessage="No project users found."
        description={
          isPrivate
            ? "Choose which non-admin project users can access this contract."
            : "Enable Private to configure non-admin user access."
        }
        disabled={!isPrivate}
      />

      <RHFCheckboxField
        control={control}
        name="allowedUsersCanSeeSov"
        label="Allow these non-admin users to view the SOV items."
        disabled={!isPrivate}
      />
    </FormSection>
  );
}
