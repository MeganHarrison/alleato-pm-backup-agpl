"use client";

import { useEffect, useMemo, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";

import { Form } from "@/components/ui/form";
import { FormGrid, FormSection } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFMultiComboboxField } from "@/components/forms/fields/RHFMultiComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { usePeople } from "@/hooks/use-people";
import { useProjectRoles } from "@/hooks/use-project-roles";
import { useProjectBudgetCodes } from "@/hooks/use-project-budget-codes";
import { useSpecifications } from "@/hooks/use-specifications";
import { projectTeamToUserOptions } from "@/lib/directory/rfi-people";
import { RFI_IMPACT_OPTIONS, type RfiFormValues } from "@/lib/schemas/rfi-schema";

interface DirectoryPerson {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  person_type?: "user" | "contact" | "employee";
  company?: { id: string; name: string } | null;
}

type PersonOption = { value: string; label: string; keywords: string[] };

function fullNameOf(person: DirectoryPerson): string {
  return `${person.first_name?.trim() || ""} ${person.last_name?.trim() || ""}`.trim();
}

function buildPersonOptions(people: DirectoryPerson[]): PersonOption[] {
  const map = new Map<string, PersonOption>();
  for (const person of people) {
    const fullName = fullNameOf(person);
    if (!fullName) continue;
    const key = fullName.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        value: fullName,
        label: fullName,
        keywords: [person.email || "", person.company?.name || ""].filter(Boolean),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Person/company option sources for RFI forms, modeled on Procore's field rules:
 *  - `userOptions`      → RFI Manager + Assignees (the project's **Project Team**)
 *  - `directoryOptions` → Received From + Distribution List (full people directory)
 *  - `companyForPerson` → maps a Received-From display name to that person's
 *                         company, used to auto-prefill the read-only
 *                         Responsible Contractor field.
 *
 * RFI Manager and Assignees are sourced from the **Project Team** — the people
 * assigned to project roles (`project_roles` / `project_role_members`), i.e.
 * exactly the roster the client sees on the Project Directory → Project Team
 * tab. This is intentionally narrow (repeated client feedback: only people
 * staffed on the project, not the whole roster).
 *
 * NOTE: earlier versions scoped these to `project_directory_memberships`, which
 * is the *broad* project roster (e.g. 27 people for a project whose Project
 * Team is 5). That was the long-standing bug this hook now fixes. See
 * `projectTeamToUserOptions` for why no `person_type` filter is applied
 * (external consultants like the Architect are `contact` rows on the team).
 *
 * Received From / Distribution List stay sourced from the company-wide
 * directory — intentionally the full people list.
 */
export function useRfiPeopleOptions(projectId: number) {
  const { roles, isLoading: isLoadingTeam } = useProjectRoles(String(projectId));
  const { people: directory, isLoading: isLoadingDirectory } = usePeople({ type: "all" });

  // RFI Manager / Assignees = the project's Project Team (role assignments).
  const userOptions = useMemo(() => projectTeamToUserOptions(roles), [roles]);

  const { directoryOptions, companyForPerson } = useMemo(() => {
    const merged = directory as DirectoryPerson[];
    const companies = new Map<string, string>();
    for (const person of merged) {
      const fullName = fullNameOf(person);
      if (!fullName || !person.company?.name) continue;
      const key = fullName.toLowerCase();
      if (!companies.has(key)) companies.set(key, person.company.name);
    }
    return {
      directoryOptions: buildPersonOptions(merged),
      companyForPerson: companies,
    };
  }, [directory]);

  return {
    userOptions,
    directoryOptions,
    companyForPerson,
    isLoading: isLoadingTeam || isLoadingDirectory,
  };
}

/**
 * Specification options for the RFI "Specification" field, sourced from the
 * project's Specifications module (specification_sections). The RFI column is
 * free text, so the selected value is stored as "section_number — title" for a
 * self-explanatory display wherever it's rendered.
 */
function useSpecificationOptions(projectId: number) {
  const { data, isLoading } = useSpecifications(String(projectId));

  const options = useMemo<PersonOption[]>(() => {
    const specs = data?.specifications ?? [];
    return specs
      .map((spec) => {
        const number = spec.section_number?.trim() || "";
        const title = spec.title?.trim() || "";
        const label = [number, title].filter(Boolean).join(" — ") || number || title;
        return { value: label, label, keywords: [number, title].filter(Boolean) };
      })
      .filter((opt) => opt.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  return { specificationOptions: options, isLoadingSpecifications: isLoading };
}

/**
 * Cost-code options for the RFI "Cost Code" field, sourced from the budget codes
 * added to the project (project_budget_codes). The RFI column is free text, so
 * the full label is stored for a self-explanatory display.
 */
function useCostCodeOptions(projectId: number) {
  const { budgetCodes, loadingCodes } = useProjectBudgetCodes(String(projectId));

  const options = useMemo<PersonOption[]>(() => {
    return budgetCodes
      .map((bc) => {
        const label = bc.fullLabel?.trim() || bc.code?.trim() || "";
        return {
          value: label,
          label,
          keywords: [bc.code || "", bc.description || ""].filter(Boolean),
        };
      })
      .filter((opt) => opt.label)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [budgetCodes]);

  return { costCodeOptions: options, isLoadingCostCodes: loadingCodes };
}

// ─────────────────────────────────────────────────────────────────────────────

interface RfiFormFieldsProps {
  form: UseFormReturn<RfiFormValues>;
  projectId: number;
  /** Wrap the fields in a `<Form>` provider. Set false when the caller already provides one. */
  withFormProvider?: boolean;
}

/**
 * Canonical field set for RFI create / edit forms.
 *
 * Used by:
 *  - `/[projectId]/rfis/new` (full-page create)
 *  - `LinkPinModal` (drawing-pin "create new RFI" tab)
 *
 * Any change to the RFI form (new field, validation, dropdown source) belongs
 * here so both surfaces stay in sync.
 *
 * The component renders fields only — submit buttons are owned by the caller
 * (because draft-vs-open submit is page-specific).
 */
export function RfiFormFields({
  form,
  projectId,
  withFormProvider = true,
}: RfiFormFieldsProps) {
  const { userOptions, directoryOptions, companyForPerson, isLoading: isLoadingPeople } =
    useRfiPeopleOptions(projectId);
  const { specificationOptions, isLoadingSpecifications } =
    useSpecificationOptions(projectId);
  const { costCodeOptions, isLoadingCostCodes } = useCostCodeOptions(projectId);

  // Procore: Responsible Contractor is auto-prefilled (read-only) from the
  // company of the person chosen in Received From. Re-derive on change; skip the
  // initial mount so a previously saved value isn't clobbered on load.
  const receivedFrom = form.watch("received_from");
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const company = receivedFrom
      ? companyForPerson.get(receivedFrom.toLowerCase()) ?? null
      : null;
    form.setValue("responsible_contractor", company, { shouldDirty: true });
  }, [receivedFrom, companyForPerson, form]);

  const fields = (
    <>
      <div className="space-y-6">
        <RHFTextField
          control={form.control}
          name="subject"
          label="Subject *"
          placeholder="Enter RFI subject"
        />

        <RHFTextareaField
          control={form.control}
          name="question"
          label="Question (required for Open)"
          placeholder="Describe the information you need..."
          rows={5}
        />

        <FormGrid columns={2}>
          <RHFDateField
            control={form.control}
            name="due_date"
            label="Due Date (required for Open)"
            nullable
          />

          <RHFMultiComboboxField
            control={form.control}
            name="assignees"
            label="Assignees (required for Open)"
            options={userOptions}
            placeholder="Select assignees"
            searchPlaceholder="Search users..."
            emptyMessage="No matching user found."
            disabled={isLoadingPeople}
          />
        </FormGrid>
      </div>

      <FormSection title="Assignment">
        <FormGrid columns={2}>
            <RHFComboboxField
              control={form.control}
              name="rfi_manager"
              label="RFI Manager"
              placeholder="Select RFI manager"
              searchPlaceholder="Search users..."
              emptyMessage="No matching user found."
              options={userOptions}
              disabled={isLoadingPeople}
            />

            <RHFComboboxField
              control={form.control}
              name="received_from"
              label="Received From"
              placeholder="Select from directory"
              searchPlaceholder="Search directory..."
              emptyMessage="No matching person found."
              options={directoryOptions}
              disabled={isLoadingPeople}
              clearable
            />

          <RHFTextField
            control={form.control}
            name="responsible_contractor"
            label="Responsible Contractor"
            placeholder="Auto-filled from Received From"
            disabled
          />

          <RHFMultiComboboxField
            control={form.control}
            name="distribution_list"
            label="Distribution List"
            options={directoryOptions}
            placeholder="Select from directory"
            searchPlaceholder="Search directory..."
            emptyMessage="No matching person found."
            disabled={isLoadingPeople}
          />
        </FormGrid>
      </FormSection>

      <FormSection title="Details">
          <FormGrid columns={2}>
            <RHFTextField
              control={form.control}
              name="location"
              label="Location"
              placeholder="Enter location"
            />

            <RHFComboboxField
              control={form.control}
              name="specification"
              label="Specification"
              placeholder="Select specification section"
              searchPlaceholder="Search specifications..."
              emptyMessage="No specifications found for this project."
              options={specificationOptions}
              disabled={isLoadingSpecifications}
              clearable
            />

            <RHFComboboxField
              control={form.control}
              name="cost_code"
              label="Cost Code"
              placeholder="Select cost code"
              searchPlaceholder="Search cost codes..."
              emptyMessage="No cost codes added to this project."
              options={costCodeOptions}
              disabled={isLoadingCostCodes}
              clearable
            />

            <RHFTextField
              control={form.control}
              name="rfi_stage"
              label="RFI Stage"
              placeholder="Enter RFI stage"
            />

            <RHFSelectField
              control={form.control}
              name="schedule_impact"
              label="Schedule Impact"
              placeholder="Select..."
              options={RFI_IMPACT_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />

            <RHFSelectField
              control={form.control}
              name="cost_impact"
              label="Cost Impact"
              placeholder="Select..."
              options={RFI_IMPACT_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
            />
          </FormGrid>

          <FormGrid columns={2}>
            <RHFTextField
              control={form.control}
              name="reference"
              label="Reference"
              placeholder="Enter reference"
            />

            <RHFTextField
              control={form.control}
              name="drawing_number"
              label="Drawing Number"
              placeholder="Enter drawing/sheet number"
            />
          </FormGrid>

          <RHFCheckboxField
            control={form.control}
            name="is_private"
            label="Private"
          />
      </FormSection>
    </>
  );

  if (!withFormProvider) return fields;

  return <Form {...form}>{fields}</Form>;
}

/**
 * Returns fresh RHF defaultValues for an empty RFI form. Called at render
 * time so date-relative defaults (due date = today + 14 days) are always
 * current rather than frozen at module load time.
 */
export function getRfiFormDefaults(): RfiFormValues {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  return {
    subject: "",
    question: "",
    due_date: dueDateStr,
    assignees: [],
    rfi_manager: null,
    received_from: null,
    responsible_contractor: null,
    distribution_list: [],
    location: null,
    specification: null,
    cost_code: null,
    schedule_impact: "no",
    cost_impact: "no",
    reference: null,
    is_private: false,
    rfi_stage: "Open",
    drawing_number: null,
  };
}

/** @deprecated Use getRfiFormDefaults() so date-relative fields stay current. */
export const RFI_FORM_DEFAULTS: RfiFormValues = getRfiFormDefaults();
