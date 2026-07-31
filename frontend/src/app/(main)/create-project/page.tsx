"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type Path, type Resolver } from "react-hook-form";
import { Settings } from "lucide-react";
import { EmptyState } from "@/components/ds";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PageShell, FormContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useDevAutoFill } from "@/hooks/use-dev-autofill";
import { Form, FormField } from "@/components/ui/form";
import { FormGrid } from "@/components/forms/FormGrid";
import { FormSection as StandardFormSection } from "@/components/forms/FormSection";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { ProjectCreatedModal } from "@/components/project/ProjectCreatedModal";
import { useCreateProjectDevConfig } from "@/components/project/create-project-dev-config";
import { apiFetch } from "@/lib/api-client";
import {
  createProjectSchema,
  defaultValues,
  formSections,
  FormLayoutMode,
  isControlAllowedForField,
  type CreateProjectFormValues,
  type FieldDefinition,
  type FormSection,
} from "@/lib/create-project/form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PROJECT_MEDIA_TOOLTIP: Record<string, string> = {
  project_logo:
    "Accepted formats: .jpg, .jpeg, .png, .tif, .tiff, .bmp. Square image recommended.",
  project_photo:
    "Accepted formats: .jpg, .jpeg, .png, .tif, .tiff, .bmp. Landscape image recommended.",
};

const getFileName = (value: unknown) =>
  typeof File !== "undefined" && value instanceof File ? value.name : null;

export default function CreateProjectPage() {
  return (
    <PageShell
      variant="form"
      title="Create Project"
      description="Set up core project details, location, and delivery defaults."
    >
      <CreateProjectForm />
    </PageShell>
  );
}

function CreateProjectForm() {
  const router = useRouter();
  const searchParams = useSearchParams()! ?? new URLSearchParams();
  const isOnboardingTestProject = searchParams.get("testProject") === "1";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileResetKey, setFileResetKey] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdProject, setCreatedProject] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema) as Resolver<CreateProjectFormValues>,
    defaultValues: {
      ...defaultValues,
      test_project: isOnboardingTestProject || defaultValues.test_project,
    },
  });

  const { DevAutoFillButton } = useDevAutoFill("project", form.setValue as Parameters<typeof useDevAutoFill>[1]);
  const { isDevAdmin, activeTemplateConfig } = useCreateProjectDevConfig();

  const effectiveFormSections = useMemo(() => {
    if (!isDevAdmin) return formSections;

    return formSections
      .map((section) => {
        const sectionOverride = activeTemplateConfig.sections[section.id];
        if (sectionOverride?.hidden) return null;

        const fields = section.fields
          .filter((field) => !activeTemplateConfig.fields[field.name]?.hidden)
          .map((field) => {
            const fieldOverride = activeTemplateConfig.fields[field.name];
            if (!fieldOverride) return field;

            const control =
              fieldOverride.control &&
              isControlAllowedForField(field, fieldOverride.control)
                ? fieldOverride.control
                : field.control;

            return { ...field, control, colSpan: fieldOverride.colSpan ?? field.colSpan };
          });

        if (fields.length === 0) return null;
        return { ...section, fields };
      })
      .filter((section): section is FormSection => section !== null);
  }, [activeTemplateConfig, isDevAdmin]);

  const handleSubmit = async (values: CreateProjectFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        name: values.name,
        "job number": values.project_number || null,
        stage: values.stage || null,
        phase: values.phase || null,
        type: values.project_type || null,
        summary: values.description || null,
        address: values.street_address,
        state: values.state || null,
        archived: !values.active,
        "start date": values.start_date?.trim() ? values.start_date : null,
        "est completion": values.completion_date?.trim() ? values.completion_date : null,
        "est revenue": values.total_value ?? null,
        work_scope: values.work_scope || null,
        project_sector: values.project_sector || null,
        delivery_method: values.delivery_method || null,
        onedrive: values.onedrive || null,
        summary_metadata: {
          square_footage: values.square_footage ?? null,
          project_code: values.project_code || null,
          city: values.city,
          postal_code: values.postal_code || null,
          country: values.country,
          office: values.office || null,
          erp_sync: values.erp_sync,
          test_project: values.test_project,
          project_logo: getFileName(values.project_logo),
          project_photo: getFileName(values.project_photo),
        },
      };

      const project = await apiFetch<{ id: string | number }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCreatedProject({ id: String(project.id), name: values.name });
      setShowSuccessModal(true);
      form.reset(defaultValues);
      setFileResetKey((key) => key + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      form.setError("root", { type: "server", message });
      toast.error("Failed to create project", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFileField = (field: FieldDefinition, fullWidth: boolean) => {
    const fieldName = field.name as Path<CreateProjectFormValues>;
    const tooltipContent = PROJECT_MEDIA_TOOLTIP[field.name];
    const shouldHideMediaHint =
      field.name === "project_logo" || field.name === "project_photo";
    const fieldLabel = tooltipContent ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{field.label}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm text-left">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      field.label
    );

    return (
      <FormField
        control={form.control}
        name={fieldName}
        render={({ field: rhf, fieldState }) => {
          const value = rhf.value;
          const file =
            typeof File !== "undefined" && value instanceof File ? value : null;

          return (
            <FileUploadField
              key={`${field.name}-${fileResetKey}`}
              label={fieldLabel}
              hint={shouldHideMediaHint ? undefined : field.description}
              error={fieldState.error?.message}
              accept={field.accept}
              maxFiles={1}
              variant="minimal"
              showMetaText={!shouldHideMediaHint}
              value={file ? [{ name: file.name, size: file.size, type: file.type }] : []}
              onChange={(files) => {
                if (files.length === 0) {
                  rhf.onChange(undefined);
                  setFileResetKey((k) => k + 1);
                }
              }}
              onFilesSelected={(files) => rhf.onChange(files[0] ?? undefined)}
            />
          );
        }}
      />
    );
  };

  const renderField = (field: FieldDefinition) => {
    const fieldName = field.name as Path<CreateProjectFormValues>;
    const fullWidth = field.colSpan === "full";
    const label = `${field.label}${field.required ? " *" : ""}`;

    let node: React.ReactNode;

    switch (field.control) {
      case "textarea":
        node = (
          <RHFTextareaField
            control={form.control}
            name={fieldName}
            label={label}
            description={field.description}
            placeholder={field.placeholder}
            rows={5}
          />
        );
        break;

      case "select":
        node = (
          <RHFSelectField
            control={form.control}
            name={fieldName}
            label={label}
            description={field.description}
            placeholder={
              field.placeholder ?? `Select ${field.label.toLowerCase()}`
            }
            options={field.options ?? []}
          />
        );
        break;

      case "formatted-number":
      case "number":
        node = (
          <RHFNumberField
            control={form.control}
            name={fieldName}
            label={label}
            description={field.description}
            placeholder={field.placeholder}
            step={field.step ? Number(field.step) : 1}
          />
        );
        break;

      case "currency":
        node = (
          <RHFMoneyField
            control={form.control}
            name={fieldName}
            label={label}
            description={field.description}
            placeholder={field.placeholder}
          />
        );
        break;

      case "date":
        node = (
          <RHFDateField
            control={form.control}
            name={fieldName}
            label={label}
            description={field.description}
          />
        );
        break;

      case "checkbox":
        node = (
          <RHFCheckboxField
            control={form.control}
            name={fieldName}
            label={field.label}
            description={field.description}
          />
        );
        break;

      case "file":
        node = renderFileField(field, fullWidth);
        break;

      default:
        node = (
          <RHFTextField
            control={form.control}
            name={fieldName}
            label={label}
            description={field.description}
            placeholder={field.placeholder}
          />
        );
    }

    return (
      <div key={field.name} className={fullWidth ? "md:col-span-2" : undefined}>
        {node}
      </div>
    );
  };

  const activeLayout: FormLayoutMode = isDevAdmin
    ? activeTemplateConfig.layout === "cards"
      ? "sections"
      : activeTemplateConfig.layout
    : "sections";

  const renderSection = (section: FormSection) => {
    const sectionColumns =
      section.id === "project-status" ? 1 : activeLayout === "single-column" ? 1 : 2;
    const hideSectionDescription = section.id === "logo";

    return (
      <StandardFormSection
        key={section.id}
        title={section.title}
        description={hideSectionDescription ? undefined : section.description}
      >
        <FormGrid columns={sectionColumns}>
          {section.fields.map(renderField)}
        </FormGrid>
      </StandardFormSection>
    );
  };

  return (
    <>
      <ProjectCreatedModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        onViewDashboard={() => {
          setShowSuccessModal(false);
          if (createdProject?.id) router.push(`/${createdProject.id}/home`);
        }}
        projectId={createdProject?.id ?? ""}
        projectName={createdProject?.name ?? ""}
      />

      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-8"
          >
            {effectiveFormSections.length > 0 ? (
              effectiveFormSections.map(renderSection)
            ) : (
              <EmptyState
                icon={<Settings />}
                title="No fields visible"
                description="No fields are currently visible for the selected template."
              />
            )}

            <FormServerError message={form.formState.errors.root?.message} />

            <FormActions
              submitLabel={isSubmitting ? "Creating Project..." : "Create Project"}
              onCancel={() => router.push("/")}
              isSubmitting={isSubmitting}
              stickyOnMobile
            >
              <div className="flex flex-wrap items-center gap-3">
                <DevAutoFillButton />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.reset(defaultValues);
                    setFileResetKey((key) => key + 1);
                  }}
                >
                  Reset Form
                </Button>
              </div>
            </FormActions>
          </form>
        </Form>
      </FormContainer>
    </>
  );
}
