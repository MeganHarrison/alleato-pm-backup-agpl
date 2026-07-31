"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { FormSection } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFMultiComboboxField } from "@/components/forms/fields/RHFMultiComboboxField";
import type { CreateSubcontractInput } from "@/lib/schemas/create-subcontract-schema";

interface PrivacySectionProps {
  isSubmitting: boolean;
  userOptions: Array<{ value: string; label: string }>;
  isLoadingUsers: boolean;
}

export function PrivacySection({
  isSubmitting,
  userOptions,
  isLoadingUsers,
}: PrivacySectionProps) {
  const { control } = useFormContext<CreateSubcontractInput>();
  const privacyIsPrivate =
    useWatch({ control, name: "privacy.isPrivate" }) ?? true;

  return (
    <FormSection title="Contract Privacy">
      <RHFCheckboxField
        control={control}
        name="privacy.isPrivate"
        label="Private — visible only to administrators and the users below"
        disabled={isSubmitting}
      />

      {privacyIsPrivate && (
        <>
          <RHFMultiComboboxField
            control={control}
            name="privacy.nonAdminUserIds"
            label="Access for Non-Admin Users"
            options={userOptions}
            placeholder={
              isLoadingUsers
                ? "Loading users..."
                : "Select users who can access this contract..."
            }
            searchPlaceholder="Search users..."
            emptyMessage="No users found."
            disabled={isSubmitting || isLoadingUsers}
          />

          <RHFCheckboxField
            control={control}
            name="privacy.allowNonAdminViewSovItems"
            label="Allow these non-admin users to view the SOV items"
            disabled={isSubmitting}
          />
        </>
      )}
    </FormSection>
  );
}
