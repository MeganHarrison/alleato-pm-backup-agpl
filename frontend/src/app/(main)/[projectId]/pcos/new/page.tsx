"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { handleFormError } from "@/lib/handle-form-error";
import { FormContainer, PageShell } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { Button } from "@/components/ui/button";
import {
  PCOWorkspace,
  buildPcoCreatePayload,
  getPcoFormDefaults,
  pcoFormSchema,
  type PCOFormValues,
} from "@/components/domain/pcos/PCOWorkspace";
import { useProjectChangeEvents } from "@/hooks/use-change-events";
import { useCreatePCO } from "@/hooks/use-pcos";

// =============================================================================
// Page Component
// =============================================================================

export default function NewPCOPage() {
  const params = useParams<{ projectId: string }>()!;
  const router = useRouter();
  const projectId = params.projectId ?? "";
  const projectIdNum = parseInt(projectId, 10);

  const { changeEvents, isLoading: isLoadingCEs } = useProjectChangeEvents(
    projectIdNum,
    { limit: 500, enabled: projectIdNum > 0 },
  );

  const createPCO = useCreatePCO(projectId);

  const form = useForm<PCOFormValues>({
    resolver: zodResolver(pcoFormSchema),
    defaultValues: getPcoFormDefaults(),
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isPending = isSaving || isSubmitting;

  async function handleSaveDraft(values: PCOFormValues) {
    setIsSaving(true);
    try {
      await createPCO.mutateAsync(buildPcoCreatePayload(values) as never);
      router.push(`/${projectId}/pcos`);
    } catch (error) {
      handleFormError(error, { entity: "PCO draft", action: "save" });
      form.setError("root", {
        type: "server",
        message:
          error instanceof Error
            ? error.message
            : "The PCO draft could not be saved. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitToClient(values: PCOFormValues) {
    if (values.changeEvents.length === 0) {
      toast.error("Add at least one change event to the PCO.");
      return;
    }
    if (values.lineItems.length === 0) {
      toast.error("Add at least one line item to the PCO.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createPCO.mutateAsync(
        buildPcoCreatePayload(values, { submit: true }) as never,
      );
      toast.success("PCO created and submitted to client.");
      router.push(`/${projectId}/pcos`);
    } catch (error) {
      handleFormError(error, { entity: "PCO", action: "create" });
      form.setError("root", {
        type: "server",
        message:
          error instanceof Error
            ? error.message
            : "The PCO could not be created. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageShell
      variant="form"
      title="New Potential Change Order"
      description="Group change events, add line items, and submit a PCO to the client."
      onBack={() => router.back()}
      backLabel="Back to PCOs"
    >
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form
            noValidate
            onSubmit={form.handleSubmit(handleSubmitToClient)}
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
                onClick={form.handleSubmit(handleSaveDraft)}
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
