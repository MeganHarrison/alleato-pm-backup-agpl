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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { handleFormError } from "@/lib/handle-form-error";
import { procurementItemInputSchema, procurementLifecycleStatuses, type ProcurementLifecycleStatus } from "@/lib/procurement/api";
import {
  useLinkProcurementScheduleTask,
  useLinkProcurementSubmittal,
  useProcurementItem,
  useUnlinkProcurementScheduleTask,
  useUnlinkProcurementSubmittal,
  useUpdateProcurementItem,
} from "@/hooks/use-procurement";
import { useSubmittals } from "@/hooks/use-submittals";
import { useScheduleTasks } from "@/hooks/use-schedule-tasks";
import { formatProcurementStatus } from "@/features/procurement/procurement-table-config";

type FormValues = {
  title: string;
  description: string;
  lifecycle_status: ProcurementLifecycleStatus;
};

export function ProcurementItemDetailClient() {
  const params = useParams<{ projectId: string; procurementItemId: string }>();
  const router = useRouter();
  const projectId = Number(params?.projectId);
  const procurementItemId = params?.procurementItemId ?? "";
  const itemQuery = useProcurementItem(projectId, procurementItemId);
  const updateItem = useUpdateProcurementItem(projectId, procurementItemId);
  const linkSubmittal = useLinkProcurementSubmittal(projectId, procurementItemId);
  const linkScheduleTask = useLinkProcurementScheduleTask(projectId, procurementItemId);
  const unlinkSubmittal = useUnlinkProcurementSubmittal(projectId, procurementItemId);
  const unlinkScheduleTask = useUnlinkProcurementScheduleTask(projectId, procurementItemId);
  const submittalsQuery = useSubmittals(projectId);
  const scheduleQuery = useScheduleTasks({ projectId: String(projectId), enabled: Number.isInteger(projectId) });
  const [selectedSubmittalId, setSelectedSubmittalId] = React.useState("");
  const [selectedScheduleTaskId, setSelectedScheduleTaskId] = React.useState("");
  const form = useForm<FormValues>({
    resolver: zodResolver(procurementItemInputSchema),
    defaultValues: { title: "", description: "", lifecycle_status: "awaiting_submittal" },
  });
  const item = itemQuery.data?.data;

  React.useEffect(() => {
    if (!item) return;
    form.reset({ title: item.title, description: item.description ?? "", lifecycle_status: item.lifecycle_status });
  }, [form, item]);

  async function onSubmit(values: FormValues) {
    try {
      await updateItem.mutateAsync({ ...values, description: values.description || null });
    } catch (error) {
      handleFormError(error, { entity: "procurement item", action: "save" });
      form.setError("root", { message: error instanceof Error ? error.message : "The procurement item could not be saved." });
    }
  }

  async function addSubmittal() {
    if (!selectedSubmittalId) return;
    try {
      await linkSubmittal.mutateAsync(selectedSubmittalId);
      setSelectedSubmittalId("");
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "The submittal could not be linked." });
    }
  }

  async function addScheduleTask() {
    if (!selectedScheduleTaskId) return;
    try {
      await linkScheduleTask.mutateAsync(selectedScheduleTaskId);
      setSelectedScheduleTaskId("");
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "The schedule activity could not be linked." });
    }
  }

  async function removeSubmittal(submittalId: string) {
    try {
      await unlinkSubmittal.mutateAsync(submittalId);
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "The submittal link could not be removed." });
    }
  }

  async function removeScheduleTask(scheduleTaskId: string) {
    try {
      await unlinkScheduleTask.mutateAsync(scheduleTaskId);
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : "The schedule activity link could not be removed." });
    }
  }

  if (itemQuery.isLoading) {
    return <PageShell variant="detail" title="Loading procurement item" onBack={() => router.push(`/${projectId}/procurement`)}><div className="text-sm text-muted-foreground">Loading…</div></PageShell>;
  }
  if (!item) {
    return <PageShell variant="detail" title="Procurement item unavailable" onBack={() => router.push(`/${projectId}/procurement`)}><p className="text-sm text-destructive">{itemQuery.error instanceof Error ? itemQuery.error.message : "The procurement item could not be found."}</p></PageShell>;
  }

  const linkedSubmittalIds = new Set(item.procurement_item_submittal_links.map((link) => link.submittal_id));
  const linkedTaskIds = new Set(item.procurement_item_schedule_task_links.map((link) => link.schedule_task_id));
  const availableSubmittals = (submittalsQuery.data ?? []).filter((submittal) => !linkedSubmittalIds.has(submittal.id));
  const availableTasks = (scheduleQuery.data?.tasks ?? []).filter((task) => !linkedTaskIds.has(task.id));

  return (
    <PageShell variant="detail" title={item.title} onBack={() => router.push(`/${projectId}/procurement`)} backLabel="Back to procurement log">
      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <section className="space-y-5">
              <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                <Label htmlFor="title">Material or component</Label>
                <div>
                  <Input id="title" {...form.register("title")} />
                  {form.formState.errors.title && <p className="mt-1 text-sm text-destructive">{form.formState.errors.title.message}</p>}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center">
                <Label htmlFor="lifecycle-status">Status</Label>
                <Select value={form.watch("lifecycle_status")} onValueChange={(value) => form.setValue("lifecycle_status", value as ProcurementLifecycleStatus, { shouldDirty: true })}>
                  <SelectTrigger id="lifecycle-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{procurementLifecycleStatuses.map((status) => <SelectItem key={status} value={status}>{formatProcurementStatus(status)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
                <Label htmlFor="description" className="sm:pt-2">Notes</Label>
                <Textarea id="description" {...form.register("description")} />
              </div>
            </section>
            <FormServerError message={form.formState.errors.root?.message} />
            <FormActions onCancel={() => router.push(`/${projectId}/procurement`)} isSubmitting={updateItem.isPending} submitLabel="Save changes" stickyOnMobile />
          </form>
        </Form>
        <section className="mt-10 space-y-4 border-t pt-8">
          <div><h2 className="text-lg font-semibold">Submittals</h2><p className="text-sm text-muted-foreground">Link the approval record that governs this item.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={selectedSubmittalId} onValueChange={setSelectedSubmittalId}>
              <SelectTrigger><SelectValue placeholder="Select a submittal" /></SelectTrigger>
              <SelectContent>{availableSubmittals.map((submittal) => <SelectItem key={submittal.id} value={submittal.id}>{submittal.submittal_number} · {submittal.title}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addSubmittal} disabled={!selectedSubmittalId || linkSubmittal.isPending}>Link submittal</Button>
          </div>
          {item.procurement_item_submittal_links.length ? <ul className="space-y-2 text-sm">{item.procurement_item_submittal_links.map((link) => <li key={link.submittal_id} className="flex items-center justify-between gap-3"><span>{link.submittals?.submittal_number} · {link.submittals?.title}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeSubmittal(link.submittal_id)} disabled={unlinkSubmittal.isPending}>Remove</Button></li>)}</ul> : <p className="text-sm text-muted-foreground">No submittal linked.</p>}
        </section>
        <section className="mt-10 space-y-4 border-t pt-8">
          <div><h2 className="text-lg font-semibold">Schedule activities</h2><p className="text-sm text-muted-foreground">Link the activity that establishes when this item is needed on site.</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={selectedScheduleTaskId} onValueChange={setSelectedScheduleTaskId}>
              <SelectTrigger><SelectValue placeholder="Select a schedule activity" /></SelectTrigger>
              <SelectContent>{availableTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addScheduleTask} disabled={!selectedScheduleTaskId || linkScheduleTask.isPending}>Link activity</Button>
          </div>
          {item.procurement_item_schedule_task_links.length ? <ul className="space-y-2 text-sm">{item.procurement_item_schedule_task_links.map((link) => <li key={link.schedule_task_id} className="flex items-center justify-between gap-3"><span>{link.schedule_tasks?.name}</span><Button type="button" variant="ghost" size="sm" onClick={() => removeScheduleTask(link.schedule_task_id)} disabled={unlinkScheduleTask.isPending}>Remove</Button></li>)}</ul> : <p className="text-sm text-muted-foreground">No schedule activity linked.</p>}
        </section>
        <section className="mt-10 space-y-3 border-t pt-8">
          <h2 className="text-lg font-semibold">History</h2>
          {item.procurement_item_events.length ? <ol className="space-y-2 text-sm text-muted-foreground">{item.procurement_item_events.map((event) => <li key={event.id}>{formatProcurementStatus(event.event_type)} · {new Date(event.created_at).toLocaleString()}</li>)}</ol> : <p className="text-sm text-muted-foreground">No recorded changes yet.</p>}
        </section>
      </FormContainer>
    </PageShell>
  );
}
