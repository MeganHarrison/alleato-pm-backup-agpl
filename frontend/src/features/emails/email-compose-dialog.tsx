"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/unified-modal";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateEmail, useUpdateEmail, type ProjectEmail, type CreateEmailInput } from "@/hooks/use-emails";

const emailComposeSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  body: z.string().optional(),
  to_list: z.string().optional(),
  cc_list: z.string().optional(),
  from_name: z.string().optional(),
  from_email: z.string().email("Invalid email address").or(z.literal("")).optional(),
  is_private: z.boolean().optional(),
});

type EmailComposeFormData = z.infer<typeof emailComposeSchema>;

interface EmailComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  email?: ProjectEmail | null;
  onSuccess?: () => void;
  createPayloadOverrides?: Partial<CreateEmailInput>;
}

function parseCommaSeparated(value: string | undefined): string[] | null {
  if (!value || value.trim() === "") return null;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EmailComposeDialog({
  open,
  onOpenChange,
  projectId,
  email,
  onSuccess,
  createPayloadOverrides,
}: EmailComposeDialogProps) {
  const isEditing = Boolean(email);
  const createEmail = useCreateEmail(projectId);
  const updateEmail = useUpdateEmail(projectId, String(email?.id ?? ""));

  const form = useForm<EmailComposeFormData>({
    resolver: zodResolver(emailComposeSchema),
    defaultValues: {
      subject: "",
      body: "",
      to_list: "",
      cc_list: "",
      from_name: "",
      from_email: "",
      is_private: false,
    },
  });

  React.useEffect(() => {
    if (open && email) {
      form.reset({
        subject: email.subject ?? "",
        body: email.body ?? "",
        to_list: email.to_list?.join(", ") ?? "",
        cc_list: email.cc_list?.join(", ") ?? "",
        from_name: email.from_name ?? "",
        from_email: email.from_email ?? "",
        is_private: email.is_private ?? false,
      });
    } else if (open && !email) {
      form.reset({
        subject: "",
        body: "",
        to_list: "",
        cc_list: "",
        from_name: "",
        from_email: "",
        is_private: false,
      });
    }
  }, [open, email, form]);

  const isPending = createEmail.isPending || updateEmail.isPending;

  const onSubmit = async (data: EmailComposeFormData) => {
    const payload: CreateEmailInput = {
      subject: data.subject,
      body: data.body || null,
      from_name: data.from_name || null,
      from_email: data.from_email || null,
      to_list: parseCommaSeparated(data.to_list),
      cc_list: parseCommaSeparated(data.cc_list),
      is_private: data.is_private ?? false,
      status: "Draft",
    };

    if (isEditing && email) {
      await updateEmail.mutateAsync(payload);
    } else {
      await createEmail.mutateAsync({
        ...payload,
        ...createPayloadOverrides,
      });
    }

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent size="2xl">
        <ModalHeader>
          <ModalTitle>{isEditing ? "Edit Email" : "Compose Email"}</ModalTitle>
          <ModalDescription>
            {isEditing
              ? "Update the email details below."
              : "Compose a new project email. It will be saved as a draft."}
          </ModalDescription>
        </ModalHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="from_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="to_list"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="email1@example.com, email2@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cc_list"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CC</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="cc1@example.com, cc2@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Email subject..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Write your message..."
                      className="min-h-40 resize-y"
                      {...field}
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
                  <FormLabel className="text-sm font-normal">
                    Private (only visible to sender and recipients)
                  </FormLabel>
                </FormItem>
              )}
            />

            <ModalFooter>
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
                  ? "Saving..."
                  : isEditing
                    ? "Update Email"
                    : "Save as Draft"}
              </Button>
            </ModalFooter>
          </form>
        </Form>
      </ModalContent>
    </Modal>
  );
}
