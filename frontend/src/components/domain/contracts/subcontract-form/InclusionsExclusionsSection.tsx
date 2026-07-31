"use client";

import { useFormContext } from "react-hook-form";
import { FormSection } from "@/components/forms";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import type { CreateSubcontractInput } from "@/lib/schemas/create-subcontract-schema";

interface InclusionsExclusionsSectionProps {
  isSubmitting: boolean;
}

export function InclusionsExclusionsSection({
  isSubmitting,
}: InclusionsExclusionsSectionProps) {
  const { control } = useFormContext<CreateSubcontractInput>();

  return (
    <FormSection title="Inclusions & Exclusions">
      <RHFTextareaField
        control={control}
        name="inclusions"
        label="Inclusions"
        placeholder="Enter scope inclusions..."
        rows={3}
        disabled={isSubmitting}
      />

      <RHFTextareaField
        control={control}
        name="exclusions"
        label="Exclusions"
        placeholder="Enter scope exclusions..."
        rows={3}
        disabled={isSubmitting}
      />
    </FormSection>
  );
}
