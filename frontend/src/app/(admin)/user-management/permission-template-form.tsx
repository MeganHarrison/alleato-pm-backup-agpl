"use client";

import type { FieldPath } from "react-hook-form";
import { useForm } from "react-hook-form";

import { Form } from "@/components/ui/form";
import { FormActions, FormGrid, FormSection, FormServerError } from "@/components/forms";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import {
  ALL_GRANULAR_FLAGS,
  GRANULAR_FLAG_LABELS,
} from "@/lib/permissions-shared";
import type {
  GranularFlag,
  PermissionLevel,
  PermissionModule,
  PermissionTemplate,
} from "@/lib/permissions-shared";
import {
  PERMISSION_TEMPLATE_GROUPS,
  PERMISSION_TEMPLATE_MODULES,
  getPermissionTemplateToolsByGroup,
} from "./permission-template-config";
import type { PermissionTemplateModuleTool } from "./permission-template-config";

const LEVELS: PermissionLevel[] = ["none", "read", "write", "admin"];

const LEVEL_OPTIONS = LEVELS.map((level) => ({
  value: level,
  label: level.charAt(0).toUpperCase() + level.slice(1),
}));

/** Expands a single "highest" level back into the cumulative array stored in rules_json. */
const LEVEL_EXPANSION: Record<PermissionLevel, PermissionLevel[]> = {
  none: ["none"],
  read: ["read"],
  write: ["read", "write"],
  admin: ["read", "write", "admin"],
};

type RulesState = PermissionTemplate["rules_json"];

function defaultRules(): RulesState {
  return Object.fromEntries(
    PERMISSION_TEMPLATE_MODULES.map(({ moduleKey }) => [moduleKey, ["read"]])
  ) as RulesState;
}

function templateToRulesState(rules_json: PermissionTemplate["rules_json"]): RulesState {
  return Object.fromEntries(
    PERMISSION_TEMPLATE_MODULES.map(({ moduleKey }) => [
      moduleKey,
      rules_json[moduleKey] ?? ["read"],
    ])
  ) as RulesState;
}

function highestLevelOf(levels: PermissionLevel[]): PermissionLevel {
  if (levels.includes("admin")) return "admin";
  if (levels.includes("write")) return "write";
  if (levels.includes("read")) return "read";
  return "none";
}

interface FormValues {
  name: string;
  description: string;
  /** Highest level selected per module (expanded back to arrays on submit). */
  levels: Record<PermissionModule, PermissionLevel>;
  /** Whether each granular flag is enabled. */
  flags: Record<GranularFlag, boolean>;
}

function buildDefaultValues(template?: PermissionTemplate): FormValues {
  const rules = template ? templateToRulesState(template.rules_json) : defaultRules();
  const enabledFlags = new Set(template?.granular_flags ?? []);

  return {
    name: template?.name ?? "",
    description: template?.description ?? "",
    levels: Object.fromEntries(
      PERMISSION_TEMPLATE_MODULES.map(({ moduleKey }) => [
        moduleKey,
        highestLevelOf(rules[moduleKey]),
      ])
    ) as Record<PermissionModule, PermissionLevel>,
    flags: Object.fromEntries(
      ALL_GRANULAR_FLAGS.map((flag) => [flag, enabledFlags.has(flag)])
    ) as Record<GranularFlag, boolean>,
  };
}

interface Props {
  template?: PermissionTemplate;
  includeAccessControls?: boolean;
  onSave: (data: {
    name: string;
    description: string;
    rules_json: RulesState;
    granular_flags: GranularFlag[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function PermissionTemplateForm({
  template,
  includeAccessControls = true,
  onSave,
  onCancel,
}: Props) {
  const form = useForm<FormValues>({
    defaultValues: buildDefaultValues(template),
  });

  async function onSubmit(values: FormValues) {
    form.clearErrors("root");

    if (!values.name.trim()) {
      form.setError("root", { message: "Name is required" });
      return;
    }

    const rules_json = Object.fromEntries(
      PERMISSION_TEMPLATE_MODULES.map(({ moduleKey }) => [
        moduleKey,
        LEVEL_EXPANSION[values.levels[moduleKey]],
      ])
    ) as RulesState;

    const granular_flags = ALL_GRANULAR_FLAGS.filter((flag) => values.flags[flag]);

    try {
      await onSave({
        name: values.name.trim(),
        description: values.description.trim(),
        rules_json,
        granular_flags,
      });
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : "Save failed",
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
        <FormSection title="Template Details">
          <RHFTextField
            control={form.control}
            name="name"
            label="Name"
            placeholder="e.g. Site Superintendent"
          />
          <RHFTextareaField
            control={form.control}
            name="description"
            label="Description"
            placeholder="Describe who this template is for..."
            rows={2}
          />
        </FormSection>

        {includeAccessControls ? (
          <>
            {PERMISSION_TEMPLATE_GROUPS.map((group) => {
              const groupModules = getPermissionTemplateToolsByGroup(group.key).filter(
                (tool): tool is PermissionTemplateModuleTool => tool.kind === "module",
              );

              if (groupModules.length === 0) return null;

              return (
                <FormSection key={group.key} title={group.label}>
                  <FormGrid columns={2}>
                    {groupModules.map((tool) => (
                      <RHFSelectField
                        key={tool.id}
                        control={form.control}
                        name={`levels.${tool.moduleKey}` as FieldPath<FormValues>}
                        label={tool.label}
                        options={LEVEL_OPTIONS}
                      />
                    ))}
                  </FormGrid>
                </FormSection>
              );
            })}

            <FormSection title="Granular Access">
              <FormGrid columns={1}>
                {ALL_GRANULAR_FLAGS.map((flag) => (
                  <RHFCheckboxField
                    key={flag}
                    control={form.control}
                    name={`flags.${flag}` as FieldPath<FormValues>}
                    label={GRANULAR_FLAG_LABELS[flag]}
                  />
                ))}
              </FormGrid>
            </FormSection>
          </>
        ) : null}

        <FormServerError message={form.formState.errors.root?.message} />

        <FormActions
          onCancel={onCancel}
          isSubmitting={form.formState.isSubmitting}
          submitLabel={template ? "Save Changes" : "Create Template"}
        />
      </form>
    </Form>
  );
}
