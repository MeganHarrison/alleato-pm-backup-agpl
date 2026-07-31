"use client";

import * as React from "react";
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { RHFComboboxField } from "@/components/forms";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { useCompanyContacts } from "@/hooks/use-company-contacts";
import { createClient } from "@/lib/supabase/client";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import type { CreatePurchaseOrderInput } from "@/lib/schemas/create-purchase-order-schema";

interface CompanyAddress {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

type AddressPrefix = "billTo" | "shipTo";

interface PurchaseOrderAddressFieldsProps {
  /** Form control (the parent form uses an explicit control prop everywhere). */
  control: Control<CreatePurchaseOrderInput>;
  prefix: AddressPrefix;
  heading: string;
  /** Label for the person field — "Billing Contact" vs "Receiving Contact". */
  contactLabel: string;
  /** Pre-fill labels for edit mode when the option isn't loaded yet. */
  initialCompanyName?: string;
  initialContactName?: string;
  disabled?: boolean;
}

/**
 * One column of the structured Bill To / Ship To block: Company → Contact →
 * Address Line 1 → Address Line 2 → City → State → Zip, stacked vertically so
 * two columns sit side by side. Selecting a company auto-populates the address
 * from that company; all fields stay manually editable.
 */
export function PurchaseOrderAddressFields({
  control,
  prefix,
  heading,
  contactLabel,
  initialCompanyName,
  initialContactName,
  disabled,
}: PurchaseOrderAddressFieldsProps) {
  const { setValue } = useFormContext<CreatePurchaseOrderInput>();

  const companyField = `${prefix}CompanyId` as const;
  const contactField = `${prefix}ContactId` as const;
  const address1Field = `${prefix}Address` as const;
  const address2Field = `${prefix}AddressLine2` as const;
  const cityField = `${prefix}City` as const;
  const stateField = `${prefix}State` as const;
  const zipField = `${prefix}Zip` as const;

  const [companies, setCompanies] = React.useState<CompanyAddress[]>([]);
  const [loadingCompanies, setLoadingCompanies] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const fetchCompanies = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, address, city, state, zip_code")
          .order("name", { ascending: true })
          .limit(1000);
        if (error || cancelled) return;
        setCompanies((data as CompanyAddress[]) ?? []);
      } catch (error) {
        reportNonCriticalFailure({
          area: "purchase-order-address-fields",
          operation: "load-companies",
          error,
          userVisibleFallback: "Company options could not be loaded.",
        });
      } finally {
        if (!cancelled) setLoadingCompanies(false);
      }
    };
    void fetchCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  const companyOptions = React.useMemo(
    () => companies.map((c) => ({ value: c.id, label: c.name })),
    [companies],
  );

  const selectedCompanyId = useWatch({ control, name: companyField }) as string | undefined;

  const { options: contactOptions, isLoading: loadingContacts } = useCompanyContacts({
    vendorId: selectedCompanyId || undefined,
    enabled: !!selectedCompanyId,
  });

  // Auto-fill the address whenever the company changes to a different company.
  // A ref guards against clobbering manual edits on unrelated re-renders.
  const prevCompanyRef = React.useRef<string | undefined>(selectedCompanyId);
  React.useEffect(() => {
    if (selectedCompanyId === prevCompanyRef.current) return;
    prevCompanyRef.current = selectedCompanyId;
    if (!selectedCompanyId) return;
    const company = companies.find((c) => c.id === selectedCompanyId);
    if (!company) return;
    setValue(address1Field, company.address ?? "", { shouldDirty: true });
    setValue(address2Field, "", { shouldDirty: true });
    setValue(cityField, company.city ?? "", { shouldDirty: true });
    setValue(stateField, company.state ?? "", { shouldDirty: true });
    setValue(zipField, company.zip_code ?? "", { shouldDirty: true });
    // Clear a contact that belonged to the previously-selected company.
    setValue(contactField, "", { shouldDirty: true });
  }, [
    selectedCompanyId,
    companies,
    setValue,
    address1Field,
    address2Field,
    cityField,
    stateField,
    zipField,
    contactField,
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-foreground">{heading}</p>
      <RHFComboboxField
        control={control}
        name={companyField}
        label="Company"
        options={companyOptions}
        placeholder={loadingCompanies ? "Loading companies..." : "Search companies..."}
        searchPlaceholder="Type company name..."
        emptyMessage="No companies found."
        selectedLabel={initialCompanyName}
        disabled={disabled || loadingCompanies}
      />
      <RHFComboboxField
        control={control}
        name={contactField}
        label={contactLabel}
        options={contactOptions}
        placeholder={
          !selectedCompanyId
            ? "Select a company first"
            : loadingContacts
              ? "Loading contacts..."
              : "Select contact..."
        }
        searchPlaceholder="Type contact name..."
        emptyMessage="No contacts at this company."
        selectedLabel={initialContactName}
        disabled={disabled || !selectedCompanyId || loadingContacts}
      />
      <RHFTextField
        control={control}
        name={address1Field}
        label="Address Line 1"
        placeholder="Street address"
        disabled={disabled}
      />
      <RHFTextField
        control={control}
        name={address2Field}
        label="Address Line 2"
        placeholder="Suite, unit, floor (optional)"
        disabled={disabled}
      />
      <RHFTextField
        control={control}
        name={cityField}
        label="City"
        placeholder="City"
        disabled={disabled}
      />
      <RHFTextField
        control={control}
        name={stateField}
        label="State"
        placeholder="State"
        disabled={disabled}
      />
      <RHFTextField
        control={control}
        name={zipField}
        label="Zip Code"
        placeholder="Zip"
        disabled={disabled}
      />
    </div>
  );
}
