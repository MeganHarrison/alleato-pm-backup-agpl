"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/forms/FormSheet";
import type { Database } from "@/types/database.types";
import {
  PunchItemFormFields,
  buildPunchItemDefaults,
  punchItemFormSchema,
  type PunchItemFormValues,
} from "./punch-item-form-fields";

// Re-export so existing callers (e.g. punch list page) keep working.
export type { PunchItemFormValues };

type PunchItemRow = Database["public"]["Tables"]["punch_items"]["Row"];

const FORM_ID = "punch-item-form-sheet";

interface PunchItemFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PunchItemFormValues) => void;
  defaultValues?: Partial<PunchItemRow>;
  isLoading?: boolean;
  mode?: "create" | "edit";
  projectId?: number;
}

export function PunchItemFormSheet({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  isLoading = false,
  mode = "create",
  projectId,
}: PunchItemFormSheetProps) {
  const form = useForm<PunchItemFormValues>({
    resolver: zodResolver(punchItemFormSchema),
    reValidateMode: "onBlur",
    defaultValues: buildPunchItemDefaults(defaultValues),
  });

  useEffect(() => {
    if (open) {
      form.reset(buildPunchItemDefaults(defaultValues));
    }
  }, [open, defaultValues, form]);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Create Punch Item" : "Edit Punch Item"}
      formId={FORM_ID}
      size="lg"
      submitting={isLoading}
      submitLabel={mode === "create" ? "Create Punch Item" : "Save Changes"}
      onCancel={() => onOpenChange(false)}
    >
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const firstErrorKey = Object.keys(errors)[0] as keyof PunchItemFormValues;
          if (firstErrorKey) form.setFocus(firstErrorKey);
        })}
      >
        <PunchItemFormFields form={form} projectId={projectId} />
      </form>
    </FormSheet>
  );
}
