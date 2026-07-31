"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateTransmittal,
  useUpdateTransmittal,
  type TransmittalSummary,
} from "@/hooks/use-transmittals";
import { SectionRuleHeading } from "@/components/layout/spacing";

// ─── Schema ───────────────────────────────────────────────────────────────────

const transmittalFormSchema = z.object({
  number: z.string().min(1, "Number is required"),
  subject: z.string().min(1, "Subject is required"),
  status: z.enum(["Draft", "Open", "Closed", "Void"]),
  to_company: z.string().nullable().optional(),
  to_contact: z.string().nullable().optional(),
  from_company: z.string().nullable().optional(),
  from_contact: z.string().nullable().optional(),
  delivery_method: z.enum([
    "Email",
    "Hand Delivery",
    "Mail",
    "Courier",
    "Fax",
    "Other",
  ]),
  sent_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
  is_private: z.boolean(),
});

type TransmittalFormValues = z.infer<typeof transmittalFormSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface TransmittalFormDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transmittal?: TransmittalSummary; // undefined = create, defined = edit
}

const STATUS_OPTIONS = ["Draft", "Open", "Closed", "Void"] as const;
const DELIVERY_OPTIONS = [
  "Email",
  "Hand Delivery",
  "Mail",
  "Courier",
  "Fax",
  "Other",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaults(
  transmittal: TransmittalSummary | undefined,
): TransmittalFormValues {
  return {
    number: transmittal?.number ?? "",
    subject: transmittal?.subject ?? "",
    status:
      (transmittal?.status as "Draft" | "Open" | "Closed" | "Void") ?? "Draft",
    to_company: transmittal?.to_company ?? "",
    to_contact: transmittal?.to_contact ?? "",
    from_company: transmittal?.from_company ?? "",
    from_contact: transmittal?.from_contact ?? "",
    delivery_method:
      (transmittal?.delivery_method as
        | "Email"
        | "Hand Delivery"
        | "Mail"
        | "Courier"
        | "Fax"
        | "Other") ?? "Email",
    sent_date: transmittal?.sent_date ?? "",
    due_date: transmittal?.due_date ?? "",
    remarks: transmittal?.remarks ?? "",
    is_private: transmittal?.is_private ?? false,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransmittalFormDialog({
  projectId,
  open,
  onOpenChange,
  transmittal,
}: TransmittalFormDialogProps) {
  const isEditing = Boolean(transmittal);
  const createMutation = useCreateTransmittal(projectId);
  const updateMutation = useUpdateTransmittal(
    projectId,
    String(transmittal?.id ?? ""),
  );

  const form = useForm<TransmittalFormValues>({
    resolver: zodResolver(transmittalFormSchema),
    defaultValues: buildDefaults(transmittal),
  });

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      form.reset(buildDefaults(transmittal));
    }
  }, [open, transmittal, form]);

  async function onSubmit(values: TransmittalFormValues) {
    const payload = {
      ...values,
      to_company: values.to_company || null,
      to_contact: values.to_contact || null,
      from_company: values.from_company || null,
      from_contact: values.from_contact || null,
      sent_date: values.sent_date || null,
      due_date: values.due_date || null,
      remarks: values.remarks || null,
    };

    if (isEditing) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Transmittal" : "Create Transmittal"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* ── General Information ── */}
            <section className="space-y-4">
              <SectionRuleHeading label="General Information" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. T-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Shop Drawings - Structural Steel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* ── Sender & Recipient ── */}
            <section className="space-y-4">
              <SectionRuleHeading label="Sender &amp; Recipient" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="from_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Company</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Sending company"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="from_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>From Contact</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Sender name"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="to_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Company</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Recipient company"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="to_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Contact</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Recipient name"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* ── Delivery & Dates ── */}
            <section className="space-y-4">
              <SectionRuleHeading label="Delivery &amp; Dates" />

              <FormField
                control={form.control}
                name="delivery_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Method</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DELIVERY_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <RHFDateField
                  control={form.control}
                  name="sent_date"
                  label="Sent Date"
                  nullable
                />
                <RHFDateField
                  control={form.control}
                  name="due_date"
                  label="Due Date"
                  nullable
                />
              </div>
            </section>

            {/* ── Content ── */}
            <section className="space-y-4">
              <SectionRuleHeading label="Content" />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Additional remarks..."
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_private"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer font-normal">
                      Private (visible only to admins)
                    </FormLabel>
                  </FormItem>
                )}
              />
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? isEditing
                    ? "Updating..."
                    : "Creating..."
                  : isEditing
                    ? "Update Transmittal"
                    : "Create Transmittal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
