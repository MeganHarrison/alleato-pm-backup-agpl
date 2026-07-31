"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";

import { FormGrid, FormSection, RichTextField } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { apiFetch } from "@/lib/api-client";
import type { ChangeEventFormData } from "./types";
import {
  STATUS_OPTIONS,
  ORIGIN_OPTIONS,
  TYPE_OPTIONS,
  CHANGE_REASON_OPTIONS,
  SCOPE_OPTIONS,
  REVENUE_SOURCE_OPTIONS,
} from "./types";

interface OriginOption {
  id: string;
  label: string;
  number: string | null;
  status: string | null;
}

interface GeneralInfoSectionProps {
  form: UseFormReturn<ChangeEventFormData>;
  nextNumber?: string;
  primeContractSelectOptions: Array<{ value: string; label: string }>;
  hasPrimeContracts: boolean;
  projectId: number;
  showDescription?: boolean;
}

export function GeneralInfoSection({
  form,
  nextNumber,
  primeContractSelectOptions,
  hasPrimeContracts,
  projectId,
  showDescription = true,
}: GeneralInfoSectionProps) {
  const { control } = form;
  const [originRecordOptions, setOriginRecordOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [loadingOriginRecords, setLoadingOriginRecords] = useState(false);

  const origin = form.watch("origin");
  const expectingRevenue = form.watch("expectingRevenue") !== false;
  const contractNumber = form.watch("contractNumber");

  // Reset the Origin Record selection whenever the Origin changes (but not on
  // initial mount / hydration, so a saved value isn't clobbered on edit).
  const previousOrigin = useRef(origin);
  useEffect(() => {
    if (previousOrigin.current === origin) return;
    previousOrigin.current = origin;
    form.setValue("originId", undefined, { shouldDirty: true });
  }, [origin, form]);

  useEffect(() => {
    if (!origin) {
      setOriginRecordOptions([]);
      return;
    }

    let cancelled = false;
    setLoadingOriginRecords(true);

    apiFetch<{ data?: OriginOption[] }>(
      `/api/projects/${projectId}/change-events/origin-options?type=${origin}`,
    )
      .then((json) => {
        if (cancelled) return;
        const options = (json.data || []).map((opt: OriginOption) => ({
          value: opt.id,
          label: opt.label,
        }));
        setOriginRecordOptions(options);
      })
      .catch(() => {
        if (!cancelled) setOriginRecordOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingOriginRecords(false);
      });

    return () => {
      cancelled = true;
    };
  }, [origin, projectId]);

  return (
    <FormSection title="General Information">
      <FormGrid columns={3}>
        <RHFTextField
          control={control}
          name="contractNumber"
          label="Number"
          placeholder={nextNumber ? nextNumber : "Auto-generated"}
          disabled={!contractNumber && !!nextNumber}
        />
        <RHFTextField
          control={control}
          name="title"
          label="Title *"
          placeholder="e.g. Added storefront blocking"
        />
        <RHFSelectField
          control={control}
          name="status"
          label="Status *"
          options={STATUS_OPTIONS}
        />

        <RHFSelectField
          control={control}
          name="origin"
          label="Origin"
          placeholder="Select Origin"
          options={ORIGIN_OPTIONS}
        />
        {origin ? (
          <RHFSelectField
            control={control}
            name="originId"
            label="Origin Record"
            placeholder={
              loadingOriginRecords
                ? "Loading..."
                : `Select ${ORIGIN_OPTIONS.find((o) => o.value === origin)?.label || "record"}`
            }
            options={originRecordOptions}
            disabled={loadingOriginRecords || originRecordOptions.length === 0}
          />
        ) : null}
        <RHFSelectField
          control={control}
          name="type"
          label="Type *"
          placeholder="Select Type"
          options={TYPE_OPTIONS}
        />
        <RHFSelectField
          control={control}
          name="changeReason"
          label="Change Reason"
          placeholder="Select Change Reason"
          options={CHANGE_REASON_OPTIONS}
        />

        <RHFSelectField
          control={control}
          name="scope"
          label="Scope"
          placeholder="Select Scope"
          options={SCOPE_OPTIONS}
        />
        <RHFCheckboxField
          control={control}
          name="expectingRevenue"
          label="Expecting revenue from this change"
        />
        {expectingRevenue ? (
          <RHFSelectField
            control={control}
            name="lineItemRevenueSource"
            label="Line Item Revenue Source"
            placeholder="Select Revenue Source"
            options={REVENUE_SOURCE_OPTIONS}
          />
        ) : null}
        <RHFSelectField
          control={control}
          name="primeContractId"
          label="Prime Contract (markup basis)"
          placeholder={
            hasPrimeContracts
              ? "Select Prime Contract"
              : "No prime contract on this project"
          }
          options={primeContractSelectOptions}
          disabled={!hasPrimeContracts}
        />
        {showDescription ? (
          <div className="md:col-span-3">
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <RichTextField
                  label="Description"
                  value={field.value || ""}
                  onChange={(value) => field.onChange(value)}
                  placeholder="e.g. Added storefront blocking at the main entry."
                />
              )}
            />
          </div>
        ) : null}
      </FormGrid>
    </FormSection>
  );
}
