"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { reportNonCriticalFailure } from "@/lib/report-non-critical-failure";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useUpdateSpecification } from "@/hooks/use-specifications";
import {
  editSpecificationSchema,
  type EditSpecificationFormData,
} from "@/lib/schemas/specification-schemas";
import type { SpecificationSection } from "@/types/specifications.types";

interface SpecificationEditModalProps {
  projectId: string;
  specification: SpecificationSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SpecificationEditModal({
  projectId,
  specification,
  open,
  onOpenChange,
}: SpecificationEditModalProps) {
  const updateMutation = useUpdateSpecification(
    projectId,
    specification?.id.toString() || ""
  );

  const form = useForm<EditSpecificationFormData>({
    resolver: zodResolver(editSpecificationSchema),
    reValidateMode: "onBlur",
    defaultValues: {
      section_number: specification?.section_number || "",
      title: specification?.title || "",
      description: specification?.description || "",
      status: (specification?.status as "active" | "archived" | "superseded") || "active",
    },
  });

  // Reset form when specification changes
  React.useEffect(() => {
    if (specification) {
      form.reset({
        section_number: specification.section_number,
        title: specification.title,
        description: specification.description || "",
        status: specification.status as "active" | "archived" | "superseded",
      });
    }
  }, [specification, form]);

  const handleSubmit = async (data: EditSpecificationFormData) => {
    if (!specification) return;
    try {
      await updateMutation.mutateAsync(data);
      onOpenChange(false);
    } catch (error) {
      reportNonCriticalFailure({
        area: "specification-edit-modal",
        operation: "update-specification",
        error,
        userVisibleFallback: "Specification was not saved.",
        metadata: { projectId, sectionId: specification.id },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Specification</DialogTitle>
          <DialogDescription>
            Update the metadata for this specification. To change the file, add a new
            revision instead.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Section Number */}
            <FormField
              control={form.control}
              name="section_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="03 30 00" {...field} />
                  </FormControl>
                  <FormDescription>
                    CSI format with numbers and spaces only
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Cast-in-Place Concrete" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the specification..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                      <SelectItem value="superseded">Superseded</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Change to "Superseded" when replaced by a newer specification
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
