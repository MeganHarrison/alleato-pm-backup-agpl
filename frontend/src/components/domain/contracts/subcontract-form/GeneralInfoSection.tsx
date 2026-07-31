"use client";

import { useFormContext } from "react-hook-form";
import { FormGrid, FormSection } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { buildOptions } from "@/components/forms/utils/buildOptions";
import {
  type CreateSubcontractInput,
  CommitmentStatusValues,
} from "@/lib/schemas/create-subcontract-schema";
import type { VendorOption } from "./types";

interface GeneralInfoSectionProps {
  isSubmitting: boolean;
  vendorOptions: VendorOption[];
  isLoadingVendors: boolean;
}

export function GeneralInfoSection({
  isSubmitting,
  vendorOptions,
  isLoadingVendors,
}: GeneralInfoSectionProps) {
  const { control } = useFormContext<CreateSubcontractInput>();

  return (
    <FormSection title="General Information">
      <FormGrid columns={2}>
        <RHFTextField
          control={control}
          name="title"
          label="Title *"
          disabled={isSubmitting}
        />

        <RHFTextField
          control={control}
          name="contractNumber"
          label="Contract # *"
          disabled={isSubmitting}
        />

        <RHFComboboxField
          control={control}
          name="contractCompanyId"
          label="Contract Company *"
          placeholder={
            isLoadingVendors ? "Loading companies..." : "Select contract company"
          }
          searchPlaceholder="Type to search companies..."
          emptyMessage={
            isLoadingVendors ? "Loading companies..." : "No companies found."
          }
          options={vendorOptions}
          disabled={isSubmitting || isLoadingVendors}
        />

        <RHFSelectField
          control={control}
          name="status"
          label="Status *"
          placeholder="Select status"
          options={buildOptions(CommitmentStatusValues)}
          disabled={isSubmitting}
        />

        <RHFNumberField
          control={control}
          name="defaultRetainagePercent"
          label="Default Retainage (%)"
          min={0}
          max={100}
          step={0.01}
          disabled={isSubmitting}
        />

        <RHFCheckboxField
          control={control}
          name="executed"
          label="Mark as Executed"
          disabled={isSubmitting}
        />
      </FormGrid>

      <RHFTextareaField
        control={control}
        name="description"
        label="Description"
        placeholder="Enter detailed contract description..."
        rows={3}
        disabled={isSubmitting}
      />
    </FormSection>
  );
}
