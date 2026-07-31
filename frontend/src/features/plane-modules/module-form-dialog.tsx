/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted from Plane v1.3.1 module form and modal templates.
 */

"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  FormServerError,
  RHFDateField,
  RHFNumberField,
  RHFSelectField,
} from "@/components/forms";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Modal,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import { PlaneModalContent } from "@/features/plane-work-items/plane-overlay";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";
import { getErrorDetail } from "@/lib/format-error";
import type { ScheduleTaskWithHierarchy, TaskStatus } from "@/types/scheduling";

import { MODULE_STATUS_OPTIONS } from "./module-model";

const moduleSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a module name.").max(255),
    status: z.enum(["not_started", "in_progress", "complete"]),
    start_date: z.string().nullable(),
    finish_date: z.string().nullable(),
    percent_complete: z.number().min(0).max(100),
  })
  .superRefine((value, context) => {
    if (
      value.start_date &&
      value.finish_date &&
      value.start_date > value.finish_date
    ) {
      context.addIssue({
        code: "custom",
        path: ["finish_date"],
        message: "Finish date must be on or after the start date.",
      });
    }
  });

type ModuleFormValues = z.infer<typeof moduleSchema>;

interface ModuleFormDialogProps {
  projectId: number;
  module: ScheduleTaskWithHierarchy | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}

function defaultsFor(
  module: ScheduleTaskWithHierarchy | null,
): ModuleFormValues {
  return {
    name: module?.name ?? "",
    status: module?.status ?? "not_started",
    start_date: module?.start_date ?? null,
    finish_date: module?.finish_date ?? null,
    percent_complete: module?.percent_complete ?? 0,
  };
}

export function ModuleFormDialog({
  projectId,
  module,
  open,
  onOpenChange,
  onSaved,
}: ModuleFormDialogProps) {
  const [serverError, setServerError] = React.useState<string | undefined>();
  const isEditing = Boolean(module);
  const form = useForm<ModuleFormValues>({
    resolver: zodResolver(moduleSchema),
    defaultValues: defaultsFor(module),
  });

  React.useEffect(() => {
    if (!open) return;
    form.reset(defaultsFor(module));
    setServerError(undefined);
  }, [form, module, open]);

  async function onSubmit(values: ModuleFormValues) {
    setServerError(undefined);

    try {
      const payload = {
        name: values.name.trim(),
        status: values.status as TaskStatus,
        start_date: values.start_date,
        finish_date: values.finish_date,
        percent_complete: values.percent_complete,
        parent_task_id: null,
        is_milestone: false,
      };

      if (module) {
        await apiFetch(
          `/api/projects/${projectId}/scheduling/tasks/${module.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiFetch(`/api/projects/${projectId}/scheduling/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(getErrorDetail(error));
    }
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <PlaneModalContent size="lg">
        <ModalHeader>
          <ModalTitle>{isEditing ? "Edit module" : "New module"}</ModalTitle>
        </ModalHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormServerError message={serverError} />
            <RHFTextField
              control={form.control}
              name="name"
              label="Name"
              placeholder="Module name"
              maxLength={255}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <RHFDateField
                control={form.control}
                name="start_date"
                label="Start date"
                nullable
              />
              <RHFDateField
                control={form.control}
                name="finish_date"
                label="Finish date"
                nullable
              />
              <RHFSelectField
                control={form.control}
                name="status"
                label="Status"
                options={MODULE_STATUS_OPTIONS}
              />
              <RHFNumberField
                control={form.control}
                name="percent_complete"
                label="Progress"
                min={0}
                max={100}
              />
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Spinner /> : null}
                {isEditing ? "Save changes" : "Create module"}
              </Button>
            </ModalFooter>
          </form>
        </Form>
      </PlaneModalContent>
    </Modal>
  );
}
