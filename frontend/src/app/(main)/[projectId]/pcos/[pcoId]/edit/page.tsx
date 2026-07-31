"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { handleFormError } from "@/lib/handle-form-error";
import { apiFetch } from "@/lib/api-client";
import { FormContainer, PageShell } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { Button } from "@/components/ui/button";
import {
  PCOWorkspace,
  buildPcoUpdatePayload,
  getPcoFormDefaults,
  mapPcoToFormValues,
  pcoFormSchema,
  type PCOFormValues,
} from "@/components/domain/pcos/PCOWorkspace";
import { useProjectChangeEvents } from "@/hooks/use-change-events";
import { usePCO } from "@/hooks/use-pcos";

// =============================================================================
// Page Component
// =============================================================================

export default function EditPCOPage() {
  const params = useParams<{ projectId: string; pcoId: string }>()!;
  const router = useRouter();
  const projectId = params.projectId ?? "";
  const pcoId = params.pcoId ?? "";
  const projectIdNum = parseInt(projectId, 10);

  const { data: pco, isLoading: isLoadingPCO, error: pcoError } = usePCO(
    projectId,
    pcoId,
  );

  const { changeEvents, isLoading: isLoadingCEs } = useProjectChangeEvents(
    projectIdNum,
    { limit: 500, enabled: projectIdNum > 0 },
  );

  const queryClient = useQueryClient();

  const form = useForm<PCOFormValues>({
    resolver: zodResolver(pcoFormSchema),
    defaultValues: getPcoFormDefaults(),
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [initialized, setInitialized] = React.useState(false);
  const isPending = isSaving || isSubmitting;

  // Populate the form from the loaded PCO once — hydrates every field including
  // the type select, grouped change events, and line items.
  React.useEffect(() => {
    if (!pco || initialized) return;
    form.reset(mapPcoToFormValues(pco));
    setInitialized(true);
  }, [pco, initialized, form]);

  async function handleSave(values: PCOFormValues, submitAfter: boolean) {
    submitAfter ? setIsSubmitting(true) : setIsSaving(true);

    try {
      // Single transactional update: header + grouped change events + all line
      // items are written together by update_pco_with_lines. A mid-write failure
      // rolls everything back, so the PCO can no longer be left half-updated.
      await apiFetch(`/api/projects/${projectId}/pcos/${pcoId}/atomic`, {
        method: "PUT",
        body: JSON.stringify(
          buildPcoUpdatePayload(values, { submit: submitAfter }),
        ),
      });

      // Refresh cached PCO data so the list/detail reflect the update.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pcos", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["pco", projectId, pcoId] }),
      ]);

      toast.success(
        submitAfter
          ? "PCO updated and submitted to client."
          : "PCO updated successfully",
      );

      router.push(`/${projectId}/pcos`);
    } catch (error) {
      handleFormError(error, { entity: "PCO", action: "save" });
      form.setError("root", {
        type: "server",
        message:
          error instanceof Error
            ? error.message
            : "The PCO could not be saved. Please try again.",
      });
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  }

  if (isLoadingPCO) {
    return (
      <PageShell
        variant="form"
        title="Edit Potential Change Order"
        onBack={() => router.back()}
      >
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading PCO...
        </p>
      </PageShell>
    );
  }

  if (pcoError || !pco) {
    return (
      <PageShell
        variant="form"
        title="Edit Potential Change Order"
        onBack={() => router.back()}
      >
        <p className="py-16 text-center text-sm text-destructive">
          {pcoError?.message ?? "PCO not found."}
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      variant="form"
      title={`Edit PCO ${pco.number}`}
      description="Update change events, line items, and PCO details."
      onBack={() => router.back()}
      backLabel="Back to PCOs"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit((values) => handleSave(values, true))}
            className="space-y-8"
          >
            <PCOWorkspace
              form={form}
              availableChangeEvents={changeEvents}
              isLoadingCEs={isLoadingCEs}
            />

            <FormServerError message={form.formState.errors.root?.message} />

            <FormActions
              onCancel={() => router.back()}
              isSubmitting={isSubmitting}
              cancelDisabled={isPending}
              submitDisabled={isPending}
              submitLabel="Submit to Client"
              stickyOnMobile
            >
              <Button
                type="button"
                variant="outline"
                onClick={form.handleSubmit((values) => handleSave(values, false))}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </Button>
            </FormActions>
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
