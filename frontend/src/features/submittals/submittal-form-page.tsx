"use client";

import * as React from "react";
import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { FormContainer, PageShell } from "@/components/layout";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { Form } from "@/components/ui/form";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { FormSection } from "@/components/forms/FormSection";
import { FormGrid } from "@/components/forms/FormGrid";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFFieldArrayTable } from "@/components/forms/fields/RHFFieldArrayTable";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { buildOptions } from "@/components/forms/utils/buildOptions";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { useProjectCompanies } from "@/hooks/use-project-companies";
import { useAuthUsers } from "@/hooks/use-auth-users";
import { useCompanyContacts } from "@/hooks/use-company-contacts";
import {
  useCreateSubmittal,
  useUpdateSubmittal,
  useWorkflowTemplates,
  uploadSubmittalAttachments,
  type SubmittalDetail,
  type SubmittalSummary,
} from "@/hooks/use-submittals";
import {
  buildAuthUserOptions,
  buildCompanyContactOptions,
  isAlleatoEmployee,
  isCompanyContact,
} from "@/lib/submittals/people-options";
import {
  normalizeSubmittalWorkflowRole,
  SUBMITTAL_WORKFLOW_ROLES,
} from "@/lib/submittals/workflow-roles";
import {
  reconcilePendingAttachmentEntries,
  toPendingAttachmentEntry,
  type PendingAttachmentEntry,
  type PendingAttachmentFileInfo,
} from "@/lib/submittals/attachment-files";
import { appToast as toast } from "@/lib/toast/app-toast";

// ─── Division lead time defaults (days) ──────────────────────────────────────

const DIVISION_LEAD_TIMES: Record<string, number> = {
  "01": 14,  // General requirements
  "02": 21,  // Existing conditions
  "03": 56,  // Concrete
  "04": 56,  // Masonry
  "05": 56,  // Metals
  "06": 42,  // Wood/plastics/composites
  "07": 42,  // Thermal & moisture protection
  "08": 84,  // Openings — doors, frames, hardware (12 weeks typical)
  "09": 28,  // Finishes
  "10": 42,  // Specialties
  "11": 56,  // Equipment
  "12": 56,  // Furnishings
  "13": 84,  // Special construction
  "14": 84,  // Conveying equipment (elevators)
  "21": 42,  // Fire suppression
  "22": 42,  // Plumbing
  "23": 42,  // HVAC
  "25": 42,  // Integrated automation
  "26": 42,  // Electrical
  "27": 42,  // Communications
  "28": 42,  // Electronic safety
  "31": 21,  // Earthwork
  "32": 21,  // Exterior improvements
  "33": 21,  // Utilities
};

function getDivisionLeadTime(specSection: string | null | undefined): number | null {
  if (!specSection) return null;
  const match = specSection.trim().match(/^(\d{2})/);
  if (!match) return null;
  return DIVISION_LEAD_TIMES[match[1]] ?? null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubmittalType {
  id: string;
  name: string;
}

function useSubmittalTypes(projectId: number) {
  return useQuery<SubmittalType[]>({
    queryKey: ["submittal-types", projectId],
    queryFn: ({ signal }) =>
      apiFetch<SubmittalType[]>(
        `/api/projects/${projectId}/submittal-types`,
        { signal },
      ),
    enabled: Boolean(projectId),
  });
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const submittalFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  submittal_number: z.string().min(1, "Number is required"),
  revision: z.number().int().min(0),
  status: z.enum(["Draft", "Open", "Distributed", "Closed"]),
  specification_section: z.string().nullable().optional(),
  submittal_type_id: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  final_due_date: z.string().nullable().optional(),
  lead_time: z.number().int().min(0).nullable().optional(),
  required_on_site_date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  is_private: z.boolean(),
  ball_in_court: z.string().nullable().optional(),
  responsible_contractor_id: z.string().nullable().optional(),
  received_from_id: z.string().nullable().optional(),
  submittal_manager_id: z.string().nullable().optional(),
  submittal_package_id: z.string().nullable().optional(),
  workflow_template_id: z.string().nullable().optional(),
  // No .default() here: keeping the schema transform-free means the Zod input
  // and output types stay identical, so zodResolver matches useForm<SubmittalFormValues>.
  // Runtime defaults are supplied by buildDefaults() via the form's defaultValues.
  initial_workflow_steps: z.array(
    z.object({
      user_id: z.string().min(1, "Reviewer is required"),
      step_type: z.string().min(1, "Role is required"),
    }),
  ),
});

type SubmittalFormValues = z.infer<typeof submittalFormSchema>;
type EditableSubmittal = SubmittalSummary & Partial<SubmittalDetail>;

const STATUS_OPTIONS = ["Draft", "Open", "Distributed", "Closed"] as const;

// Sentinel for the "no template" choice in the workflow-template selector. The
// field is discarded before POST, so this value never reaches the server.
const WORKFLOW_TEMPLATE_NONE = "__none__";

function getSubmittalTypeId(v: SubmittalSummary["submittal_type"] | undefined): string | null {
  if (!v) return null;
  if (typeof v === "object") return v.id ?? null;
  return null;
}

function createWorkflowStep(): SubmittalFormValues["initial_workflow_steps"][number] {
  return { user_id: "", step_type: "Approver" };
}

function buildDefaults(
  submittal: EditableSubmittal | undefined,
  overrides?: { submittal_package_id?: string; specification_section?: string },
): SubmittalFormValues {
  return {
    title: submittal?.title ?? "",
    submittal_number: submittal?.submittal_number ?? "",
    revision: submittal?.revision ?? 0,
    status: (submittal?.status as "Draft" | "Open" | "Distributed" | "Closed") ?? "Draft",
    specification_section:
      overrides?.specification_section ?? submittal?.specification_section ?? "",
    submittal_type_id: getSubmittalTypeId(submittal?.submittal_type),
    division: submittal?.division ?? "",
    final_due_date: submittal?.final_due_date ?? "",
    lead_time: submittal?.lead_time ?? null,
    required_on_site_date: submittal?.required_on_site_date ?? "",
    description: submittal?.description ?? "",
    is_private: submittal?.is_private ?? false,
    ball_in_court: submittal?.ball_in_court ?? "",
    responsible_contractor_id: submittal?.responsible_contractor_id ?? null,
    received_from_id: submittal?.received_from_id ?? null,
    submittal_manager_id: submittal?.submittal_manager_id ?? null,
    submittal_package_id:
      overrides?.submittal_package_id ??
      (typeof submittal?.submittal_package === "object"
        ? (submittal?.submittal_package as { id?: string } | null)?.id
        : null) ??
      null,
    workflow_template_id: WORKFLOW_TEMPLATE_NONE,
    initial_workflow_steps: [],
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubmittalFormPageProps {
  projectId: number;
  submittal?: EditableSubmittal;
  defaultOverrides?: { submittal_package_id?: string; specification_section?: string };
  mode?: "page" | "inline";
  onCancel?: () => void;
  onSaved?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubmittalFormPage({
  projectId,
  submittal,
  defaultOverrides,
  mode = "page",
  onCancel,
  onSaved,
}: SubmittalFormPageProps) {
  const router = useRouter();
  const isEditing = Boolean(submittal);

  const createMutation = useCreateSubmittal(projectId);
  const updateMutation = useUpdateSubmittal(projectId, submittal?.id ?? "");
  const [pendingAttachmentEntries, setPendingAttachmentEntries] = React.useState<
    PendingAttachmentEntry[]
  >([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = React.useState(false);

  const { companies, isLoading: companiesLoading } = useProjectCompanies(String(projectId), {
    per_page: 200,
  });
  const { users, allUsers, isLoading: usersLoading } = useAuthUsers(String(projectId));
  const { data: submittalTypes, isLoading: typesLoading } = useSubmittalTypes(projectId);
  const { data: workflowTemplates, isLoading: workflowTemplatesLoading } =
    useWorkflowTemplates(projectId);
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ["submittal-packages", projectId],
    queryFn: async () =>
      apiFetch<{ id: string; name: string }[]>(
        `/api/projects/${projectId}/submittals/packages`,
      ),
  });

  const form = useForm<SubmittalFormValues>({
    resolver: zodResolver(submittalFormSchema),
    defaultValues: buildDefaults(submittal, defaultOverrides),
  });

  const workflowFieldArray = useFieldArray({
    control: form.control,
    name: "initial_workflow_steps",
  });

  const watchedStatus = form.watch("status");
  const watchedSubmittalManager = form.watch("submittal_manager_id");
  const watchedResponsibleContractor = form.watch("responsible_contractor_id");
  const watchedRequiredOnSite = form.watch("required_on_site_date");
  const watchedLeadTime = form.watch("lead_time");
  const watchedFinalDueDate = form.watch("final_due_date");
  const watchedSpecSection = form.watch("specification_section");
  const watchedWorkflowSteps = form.watch("initial_workflow_steps");
  const watchedWorkflowTemplate = form.watch("workflow_template_id");
  const previousResponsibleContractor = React.useRef(watchedResponsibleContractor);
  const previousWorkflowTemplate = React.useRef(watchedWorkflowTemplate);

  const {
    contacts: responsibleContractorContacts,
    isLoading: receivedFromLoading,
  } = useCompanyContacts({
    companyId: watchedResponsibleContractor ?? undefined,
    enabled: Boolean(watchedResponsibleContractor),
  });

  // When creating new: default submittal_manager_id to the current logged-in user.
  // Run once on mount — supabase client is a stable singleton, safe to omit from deps.
  const formSetValue = form.setValue;
  const formGetValues = form.getValues;
  React.useEffect(() => {
    if (isEditing) return;
    const current = formGetValues("submittal_manager_id");
    if (current) return;
    const client = createClient();
    client.auth.getUser().then(({ data }) => {
      if (data.user?.id) {
        formSetValue("submittal_manager_id", data.user.id, { shouldDirty: false });
      }
    });
  }, [isEditing, formGetValues, formSetValue]);

  // When creating new: ball_in_court defaults to the submittal manager when status is Draft
  React.useEffect(() => {
    if (isEditing) return;
    const currentBic = form.getValues("ball_in_court");
    if (currentBic) return;
    if (watchedStatus === "Draft" && watchedSubmittalManager) {
      form.setValue("ball_in_court", watchedSubmittalManager, { shouldDirty: false });
    }
  }, [isEditing, watchedStatus, watchedSubmittalManager, form]);

  // Auto-compute final_due_date = required_on_site_date minus lead_time days
  React.useEffect(() => {
    if (!watchedRequiredOnSite || !watchedLeadTime) return;
    try {
      const computed = addDays(watchedRequiredOnSite, -watchedLeadTime);
      form.setValue("final_due_date", computed, { shouldDirty: true });
    } catch {
      // Invalid date — leave as-is
    }
  }, [watchedRequiredOnSite, watchedLeadTime, form]);

  // Auto-set lead_time default when spec section changes (new forms or empty lead_time)
  React.useEffect(() => {
    if (!watchedSpecSection) return;
    const currentLeadTime = form.getValues("lead_time");
    if (currentLeadTime != null) return;
    const defaultDays = getDivisionLeadTime(watchedSpecSection);
    if (defaultDays != null) {
      form.setValue("lead_time", defaultDays, { shouldDirty: false });
    }
  }, [watchedSpecSection, form]);

  // Populate the workflow steps from the chosen template. Mirrors the old
  // handleWorkflowTemplateChange handler: "build from scratch" (or none) clears
  // the steps, a real template replaces them with its steps. Guarded so it never
  // runs on mount / hydration (only on an actual template change).
  React.useEffect(() => {
    if (previousWorkflowTemplate.current === watchedWorkflowTemplate) return;
    previousWorkflowTemplate.current = watchedWorkflowTemplate;

    if (!watchedWorkflowTemplate || watchedWorkflowTemplate === WORKFLOW_TEMPLATE_NONE) {
      workflowFieldArray.replace([]);
      return;
    }

    const template = workflowTemplates?.find((item) => item.id === watchedWorkflowTemplate);
    workflowFieldArray.replace(
      (template?.steps ?? []).map((step) => ({
        user_id: step.user_id ?? "",
        step_type: normalizeSubmittalWorkflowRole(step.step_type),
      })),
    );
  }, [watchedWorkflowTemplate, workflowTemplates, workflowFieldArray]);

  const isPending =
    createMutation.isPending || updateMutation.isPending || isUploadingAttachments;

  // companies dropdown returns companies.id, which is exactly what
  // responsible_contractor_id (FK → companies.id) expects — no resolution
  // needed. But the list is scoped to the project's companies, so a saved
  // contractor no longer on the project would render an empty placeholder on
  // edit. Inject the saved contractor (name from the joined read) so it
  // pre-fills — mirrors the submittal detail page.
  const companyOptions = useMemo(() => {
    const opts = companies
      .filter((c) => c.company_id)
      .map((c) => ({
        value: c.company_id,
        label: c.company?.name ?? c.company_id,
      }));
    const saved = submittal?.responsible_contractor;
    if (saved?.id && !opts.some((o) => o.value === saved.id)) {
      opts.unshift({ value: saved.id, label: saved.name ?? saved.id });
    }
    return opts;
  }, [companies, submittal?.responsible_contractor]);

  const userOptions = useMemo(
    () =>
      users.map((u) => {
        const name =
          u.first_name || u.last_name
            ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
            : u.email;
        return {
          value: u.id,
          label: name,
          keywords: [u.email].filter(Boolean) as string[],
        };
      }),
    [users],
  );

  const managerOptions = useMemo(
    () => buildAuthUserOptions(allUsers.filter(isAlleatoEmployee)),
    [allUsers],
  );

  const receivedFromOptions = useMemo(
    () =>
      buildCompanyContactOptions(
        responsibleContractorContacts.filter(isCompanyContact),
      ),
    [responsibleContractorContacts],
  );

  const packageOptions = useMemo(
    () => (packages ?? []).map((p) => ({ value: p.id, label: p.name })),
    [packages],
  );

  const typeOptions = useMemo(
    () => (submittalTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
    [submittalTypes],
  );

  const workflowTemplateOptions = useMemo(
    () => [
      { value: WORKFLOW_TEMPLATE_NONE, label: "Build from scratch" },
      ...(workflowTemplates ?? []).map((template) => ({
        value: template.id,
        label: template.name,
      })),
    ],
    [workflowTemplates],
  );

  const roleOptions = useMemo(() => buildOptions(SUBMITTAL_WORKFLOW_ROLES), []);

  // Ball-in-court: when workflow steps are defined, restrict to those participants
  const ballInCourtOptions = useMemo(() => {
    const stepUserIds = new Set(
      (watchedWorkflowSteps ?? []).map((s) => s.user_id).filter(Boolean),
    );
    if (stepUserIds.size === 0) return userOptions;
    return userOptions.filter((u) => stepUserIds.has(u.value));
  }, [watchedWorkflowSteps, userOptions]);

  // Warning: due date + lead time exceeds required-on-site date
  const dueDateWarning = useMemo(() => {
    if (!watchedFinalDueDate || !watchedLeadTime || !watchedRequiredOnSite) return false;
    try {
      const projected = addDays(watchedFinalDueDate, watchedLeadTime);
      return projected > watchedRequiredOnSite;
    } catch {
      return false;
    }
  }, [watchedFinalDueDate, watchedLeadTime, watchedRequiredOnSite]);

  React.useEffect(() => {
    if (previousResponsibleContractor.current !== watchedResponsibleContractor) {
      previousResponsibleContractor.current = watchedResponsibleContractor;
      form.setValue("received_from_id", null, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, watchedResponsibleContractor]);

  function handleAttachmentFilesSelected(files: File[]) {
    setPendingAttachmentEntries((current) =>
      [...current, ...files.map(toPendingAttachmentEntry)].slice(0, 10),
    );
  }

  function handleAttachmentListChange(nextFiles: PendingAttachmentFileInfo[]) {
    setPendingAttachmentEntries((current) =>
      reconcilePendingAttachmentEntries(current, nextFiles),
    );
  }

  async function uploadPendingAttachments(submittalId: string) {
    const files = pendingAttachmentEntries.map((entry) => entry.file);
    if (files.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      await uploadSubmittalAttachments(projectId, submittalId, files);
      toast.success(
        files.length === 1
          ? "Attachment uploaded"
          : `${files.length} attachments uploaded`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The server did not return a reason.";
      toast.error("Submittal was created, but attachments did not upload", {
        description: message,
      });
    } finally {
      setIsUploadingAttachments(false);
    }
  }

  async function onSubmit(values: SubmittalFormValues) {
    const { workflow_template_id: _workflowTemplateId, ...submittalValues } = values;
    const payload = {
      ...submittalValues,
      specification_section: values.specification_section || null,
      submittal_type_id: values.submittal_type_id || null,
      division: values.division || null,
      final_due_date: values.final_due_date || null,
      required_on_site_date: values.required_on_site_date || null,
      description: values.description || null,
      ball_in_court: values.ball_in_court || null,
      responsible_contractor_id: values.responsible_contractor_id ?? null,
      received_from_id: values.received_from_id || null,
      submittal_manager_id: values.submittal_manager_id || null,
      submittal_package_id: values.submittal_package_id || null,
      initial_workflow_steps: values.initial_workflow_steps.map((step) => ({
        user_id: step.user_id,
        step_type: step.step_type,
      })),
    };

    try {
      if (isEditing && submittal) {
        await updateMutation.mutateAsync(payload);
        if (onSaved) {
          onSaved();
        } else {
          router.push(`/${projectId}/submittals/${submittal.id}`);
        }
      } else {
        const result = await createMutation.mutateAsync(payload);
        const newId = (result as { id?: string } | null)?.id;
        if (newId) {
          await uploadPendingAttachments(newId);
          router.push(`/${projectId}/submittals/${newId}`);
        } else {
          router.push(`/${projectId}/submittals`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The submittal could not be saved. Please try again.";
      form.setError("root", { type: "server", message });
    }
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
      return;
    }

    if (isEditing && submittal) {
      router.push(`/${projectId}/submittals/${submittal.id}`);
    } else {
      router.push(`/${projectId}/submittals`);
    }
  }

  const formContent = (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormSection title="General Information">
          <FormGrid columns={2}>
            <RHFTextField
              control={form.control}
              name="submittal_number"
              label="Number *"
              placeholder="e.g. 08-1113-1"
            />

            <RHFNumberField
              control={form.control}
              name="revision"
              label="Revision *"
              min={0}
              step={1}
            />

            <RHFTextField
              control={form.control}
              name="title"
              label="Title *"
              placeholder="e.g. Doors, Frames, Hardware"
            />

            <RHFComboboxField
              control={form.control}
              name="submittal_package_id"
              label="Submittal Package"
              placeholder={packagesLoading ? "Loading..." : "Select package"}
              searchPlaceholder="Search packages..."
              emptyMessage="No packages found."
              options={packageOptions}
              disabled={packagesLoading}
              clearable
            />

            <RHFTextField
              control={form.control}
              name="specification_section"
              label="Specification Section"
              placeholder="e.g. 08-1113 - Doors, Frames"
            />

            <RHFTextField
              control={form.control}
              name="division"
              label="Division"
              placeholder="e.g. Division 8"
            />

            <RHFComboboxField
              control={form.control}
              name="submittal_type_id"
              label="Submittal Type"
              placeholder={typesLoading ? "Loading..." : "Select type"}
              searchPlaceholder="Search types..."
              emptyMessage="No types found."
              options={typeOptions}
              disabled={typesLoading}
              clearable
            />

            <RHFSelectField
              control={form.control}
              name="status"
              label="Status"
              placeholder="Select status"
              options={buildOptions(STATUS_OPTIONS)}
            />
          </FormGrid>
        </FormSection>

        <FormSection title="People & Companies">
          <FormGrid columns={2}>
            <RHFComboboxField
              control={form.control}
              name="responsible_contractor_id"
              label="Responsible Contractor"
              placeholder={companiesLoading ? "Loading..." : "Select company"}
              searchPlaceholder="Search companies..."
              emptyMessage="No matching company found."
              options={companyOptions}
              disabled={companiesLoading}
              clearable
            />

            <RHFComboboxField
              control={form.control}
              name="received_from_id"
              label="Received From"
              placeholder={
                !watchedResponsibleContractor
                  ? "Select responsible contractor first"
                  : receivedFromLoading
                    ? "Loading..."
                    : "Select contact"
              }
              searchPlaceholder="Search contacts..."
              emptyMessage="No contacts found for this contractor."
              options={receivedFromOptions}
              disabled={!watchedResponsibleContractor || receivedFromLoading}
              clearable
            />

            <RHFComboboxField
              control={form.control}
              name="submittal_manager_id"
              label="Submittal Manager"
              placeholder={usersLoading ? "Loading..." : "Select person"}
              searchPlaceholder="Search by name or email..."
              emptyMessage="No Alleato employees found."
              options={managerOptions}
              disabled={usersLoading}
              clearable
            />
          </FormGrid>
        </FormSection>

        <FormSection title="Distribution & Scheduling">
          <FormGrid columns={2}>
            <RHFDateField
              control={form.control}
              name="final_due_date"
              label="Final Due Date"
              nullable
            />

            <RHFDateField
              control={form.control}
              name="required_on_site_date"
              label="Required On-Site Date"
              nullable
            />

            <RHFNumberField
              control={form.control}
              name="lead_time"
              label="Lead Time (days)"
              min={0}
              step={1}
            />

            <RHFComboboxField
              control={form.control}
              name="ball_in_court"
              label="Ball In Court"
              placeholder={usersLoading ? "Loading..." : "Select person"}
              searchPlaceholder="Search by name or email..."
              emptyMessage="No matching person found."
              options={ballInCourtOptions}
              disabled={usersLoading}
              clearable
            />
          </FormGrid>

          {dueDateWarning && (
            <InfoAlert variant="warning">
              Due date plus lead time extends past the required on-site date. The submittal may not arrive in time.
            </InfoAlert>
          )}
        </FormSection>

        <FormSection title="Submittal Workflow">
          {(workflowTemplates?.length ?? 0) > 0 ? (
            <div className="max-w-sm">
              <RHFSelectField
                control={form.control}
                name="workflow_template_id"
                label="Workflow Template"
                placeholder={
                  workflowTemplatesLoading ? "Loading..." : "Select template"
                }
                options={workflowTemplateOptions}
              />
            </div>
          ) : null}

          <RHFFieldArrayTable
            control={form.control}
            name="initial_workflow_steps"
            addLabel="Add Step"
            minRows={0}
            createRow={createWorkflowStep}
            columns={[
              {
                key: "step",
                header: "Step",
                mobileLabel: "Step",
                className: "w-16",
                cell: ({ index }) => (
                  <span className="text-sm text-muted-foreground">{index + 1}</span>
                ),
              },
              {
                key: "user_id",
                header: "Name",
                mobileLabel: "Name",
                className: "min-w-[220px]",
                cell: ({ rowName }) => (
                  <RHFComboboxField
                    control={form.control}
                    name={`${rowName}.user_id`}
                    label="Name"
                    placeholder={usersLoading ? "Loading..." : "Select person"}
                    searchPlaceholder="Search by name or email..."
                    emptyMessage="No matching person found."
                    options={userOptions}
                    disabled={usersLoading}
                  />
                ),
              },
              {
                key: "step_type",
                header: "Role",
                mobileLabel: "Role",
                className: "w-48",
                cell: ({ rowName }) => (
                  <RHFSelectField
                    control={form.control}
                    name={`${rowName}.step_type`}
                    label="Role"
                    placeholder="Select role"
                    options={roleOptions}
                  />
                ),
              },
            ]}
          />
        </FormSection>

        <FormSection title="Content">
          <RHFTextareaField
            control={form.control}
            name="description"
            label="Description"
            placeholder="Describe this submittal..."
            rows={4}
          />

          <RHFCheckboxField
            control={form.control}
            name="is_private"
            label="Private (visible only to admins and distribution list)"
          />
        </FormSection>

        {!isEditing ? (
          <FormSection title="Attachments">
            <FileUploadField
              value={pendingAttachmentEntries.map((entry) => entry.info)}
              onChange={handleAttachmentListChange}
              onFilesSelected={handleAttachmentFilesSelected}
              multiple
              maxFiles={10}
              maxSize={50 * 1024 * 1024}
              variant="minimal"
              showMetaText={false}
              dropzoneTestId="submittal-attachments-dropzone"
              inputTestId="submittal-attachments-input"
              fileListTestId="submittal-attachments-list"
              disabled={isPending}
            />
          </FormSection>
        ) : null}

        <FormServerError message={form.formState.errors.root?.message} />

        <FormActions
          onCancel={handleCancel}
          isSubmitting={isPending}
          submitLabel={isEditing ? "Update Submittal" : "Create Submittal"}
          stickyOnMobile
        />
      </form>
    </Form>
  );

  if (mode === "inline") {
    return formContent;
  }

  return (
    <PageShell
      variant="form"
      title={isEditing ? "Edit Submittal" : "Create Submittal"}
      onBack={handleCancel}
      backLabel="Back to Submittals"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        {formContent}
      </FormContainer>
    </PageShell>
  );
}
