"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { FormContainer, PageShell } from "@/components/layout";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { handleFormError } from "@/lib/handle-form-error";
import { procurementItemInputSchema, type ProcurementLifecycleStatus } from "@/lib/procurement/api";
import { useCreateProcurementItem } from "@/hooks/use-procurement";

type FormValues = {
  title: string;
  description: string;
  lifecycle_status: ProcurementLifecycleStatus;
};

export default function NewProcurementItemPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = Number(params?.projectId);
  const createItem = useCreateProcurementItem(projectId);
  const form = useForm<FormValues>({
    resolver: zodResolver(procurementItemInputSchema),
    defaultValues: { title: "", description: "", lifecycle_status: "awaiting_submittal" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const result = await createItem.mutateAsync({ ...values, description: values.description || null });
      router.replace(`/${projectId}/procurement/${result.data.id}`);
    } catch (error) {
      handleFormError(error, { entity: "procurement item", action: "create" });
      form.setError("root", { message: error instanceof Error ? error.message : "The procurement item could not be created." });
    }
  }

  return (
    <PageShell variant="form" title="Add Procurement Item" onBack={() => router.push(`/${projectId}/procurement`)} backLabel="Back to procurement log">
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="title">Material or component</Label>
                <Input id="title" {...form.register("title")} autoFocus />
                {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Notes</Label>
                <Textarea id="description" {...form.register("description")} />
              </div>
            </div>
            <FormServerError message={form.formState.errors.root?.message} />
            <FormActions onCancel={() => router.push(`/${projectId}/procurement`)} isSubmitting={createItem.isPending} submitLabel="Create procurement item" stickyOnMobile />
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
