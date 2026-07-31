"use client";

import { useFormContext } from "react-hook-form";
import { FormGrid, FormSection } from "@/components/forms";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import type { CreateSubcontractInput } from "@/lib/schemas/create-subcontract-schema";

interface ContractDatesSectionProps {
  isSubmitting: boolean;
}

export function ContractDatesSection({ isSubmitting }: ContractDatesSectionProps) {
  const { control } = useFormContext<CreateSubcontractInput>();

  return (
    <FormSection title="Contract Dates">
      <FormGrid columns={3}>
        <RHFDateField
          control={control}
          name="dates.startDate"
          label="Start Date"
          placeholder="Select start date"
          nullable
          disabled={isSubmitting}
        />

        <RHFDateField
          control={control}
          name="dates.estimatedCompletionDate"
          label="Estimated Completion Date"
          placeholder="Select estimated completion"
          nullable
          disabled={isSubmitting}
        />

        <RHFDateField
          control={control}
          name="dates.actualCompletionDate"
          label="Actual Completion Date"
          placeholder="Select actual completion"
          nullable
          disabled={isSubmitting}
        />

        <RHFDateField
          control={control}
          name="dates.contractDate"
          label="Contract Date"
          placeholder="Select contract date"
          nullable
          disabled={isSubmitting}
        />

        <RHFDateField
          control={control}
          name="dates.signedContractReceivedDate"
          label="Signed Contract Received Date"
          placeholder="Select signed contract received"
          nullable
          disabled={isSubmitting}
        />

        <RHFDateField
          control={control}
          name="dates.issuedOnDate"
          label="Issued On Date"
          placeholder="Select issued on date"
          nullable
          disabled={isSubmitting}
        />
      </FormGrid>
    </FormSection>
  );
}
