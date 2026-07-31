"use client";

import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import {
  getRfiFormDefaults,
  RfiFormFields,
} from "@/components/rfis/rfi-form-fields";
import { useCreateRfi } from "@/hooks/use-rfis";
import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  rfiDraftSchema,
  rfiOpenSchema,
  type RfiFormValues,
} from "@/lib/schemas/rfi-schema";

export default function NewRfiPage() {
  const router = useRouter();
  const params = useParams()! ?? {};
  const projectId = Number(params.projectId);
  const createRfi = useCreateRfi(projectId);

  const form = useForm<RfiFormValues>({
    defaultValues: getRfiFormDefaults(),
  });

  const submitRfi = async (status: "draft" | "open") => {
    const data = form.getValues();
    const schema = status === "open" ? rfiOpenSchema : rfiDraftSchema;
    const result = schema.safeParse(data);

    if (!result.success) {
      form.clearErrors("root");
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof RfiFormValues;
        if (path) {
          form.setError(path, { message: issue.message });
        }
      }
      form.setError("root", {
        message:
          status === "open"
            ? "Complete the required fields before creating an open RFI."
            : "Enter a subject before saving this RFI as a draft.",
      });
      return;
    }

    try {
      form.clearErrors("root");
      await createRfi.mutateAsync({ ...result.data, status });
      router.push(`/${projectId}/rfis`);
    } catch (error) {
      reportNonCriticalFailure({
        area: "rfis",
        operation: "create-rfi",
        error,
        userVisibleFallback: "RFI was not created.",
        metadata: { projectId, status },
      });
      form.setError("root", {
        message: "RFI was not created. Check your connection and try again.",
      });
    }
  };

  return (
    <PageShell
      variant="form"
      title="New RFI"
      onBack={() => router.push(`/${projectId}/rfis`)}
      backLabel="Back to RFIs"
    >
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          submitRfi("open");
        }}
      >
        <RfiFormFields
          form={form}
          projectId={projectId}
        />

        <FormServerError message={form.formState.errors.root?.message} />

        <FormActions
          submitLabel="Create as Open"
          cancelVariant="ghost"
          onCancel={() => router.push(`/${projectId}/rfis`)}
          isSubmitting={createRfi.isPending}
          align="between"
          sticky
        >
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <p
              aria-live="polite"
              className="min-h-5 text-sm text-muted-foreground"
            >
              {form.formState.isDirty ? "Unsaved changes" : null}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => submitRfi("draft")}
              disabled={createRfi.isPending}
              className="min-h-11"
            >
              Save as Draft
            </Button>
          </div>
        </FormActions>
      </form>
    </PageShell>
  );
}
