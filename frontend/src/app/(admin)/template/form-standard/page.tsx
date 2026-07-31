/**
 * =============================================================================
 * STANDARD FORM PAGE TEMPLATE
 * =============================================================================
 *
 * This is the CANONICAL template for all form pages in the application.
 * Copy this file and customize for your specific feature.
 *
 * RULES:
 * 1. Use ONLY standard UI components from @/components/ui
 * 2. Use ONLY standard layout components from @/components/layout
 * 3. NO custom styling on inputs, selects, or buttons
 * 4. NO Card wrappers around form sections (use section headings instead)
 * 5. Use consistent spacing (space-y-8 for sections, space-y-6 within sections)
 * 6. Form actions always at bottom with border-t separator
 *
 * COMPONENTS ALLOWED:
 * - PageHeader, PageContainer, FormContainer from @/components/layout
 * - Input, Textarea, Select, Button from @/components/ui
 * - Form, FormField, FormItem, FormLabel, FormControl, FormMessage from @/components/ui/form
 *
 * COMPONENTS NOT ALLOWED:
 * - Card, CardHeader, CardContent (use section headings instead)
 * - Custom styled buttons/inputs
 * - Inline styles or custom classNames on form controls
 */

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

// =============================================================================
// LAYOUT COMPONENTS - Always use these
// =============================================================================
import { PageHeader, PageContainer, FormContainer, PageShell } from "@/components/layout";

// =============================================================================
// UI COMPONENTS - Standard, no custom styling
// =============================================================================
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// =============================================================================
// SCHEMA - Define your validation rules here
// =============================================================================
const formSchema = z.object({
  // Required fields
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  date: z.string().min(1, "Date is required"),

  // Optional fields
  description: z.string().optional(),
  amount: z.number().min(0, "Amount must be positive").optional(),
  status: z.string(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// =============================================================================
// OPTIONS - Define select options as constants
// =============================================================================
const TYPE_OPTIONS = [
  { value: "type_a", label: "Type A" },
  { value: "type_b", label: "Type B" },
  { value: "type_c", label: "Type C" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
];

// =============================================================================
// PAGE COMPONENT
// =============================================================================
export default function StandardFormPage() {
  const params = useParams()!;
  const router = useRouter();
  const projectId = params.projectId as string;

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      amount: undefined,
      status: "draft",
      notes: "",
    },
  });

  // Form submission
  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/your-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      router.push(`/${projectId}/your-list`);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Navigation
  function handleCancel() {
    router.push(`/${projectId}/your-list`);
  }

  // ===========================================================================
  // RENDER
  // ===========================================================================
  return (
    <PageShell variant="form" title="Create New Item">
    <PageContainer maxWidth="lg">
        {/* ===================================================================
            FORM - FormContainer centers and constrains width
            =================================================================== */}
        <FormContainer maxWidth="lg" withCard={false}>
          <div className="mb-6">
            <PageHeader
              title="Create New Item"
              description="Fill out the form below to create a new item"
            />
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* =============================================================
                  SECTION 1: Basic Information
                  Use section tags with h2 headings, NOT Card components
                  ============================================================= */}
              <section className="space-y-6">
                <div className="border-b pb-2">
                  <h2 className="text-lg font-semibold">Basic Information</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the core details for this item
                  </p>
                </div>

                {/* Two-column grid for related fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name - Required */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Type - Required Select */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date - Required */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount - Optional Number */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder=""
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value ? parseFloat(value) : undefined);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Full-width textarea for description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter a description..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional details about this item
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* =============================================================
                  SECTION 2: Additional Details
                  Separate sections with space-y-8 between them
                  ============================================================= */}
              <section className="space-y-6">
                <div className="border-b pb-2">
                  <h2 className="text-lg font-semibold">Additional Details</h2>
                  <p className="text-sm text-muted-foreground">
                    Optional information and settings
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status - Select with default */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Notes - Full width */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any additional notes..."
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>

              {/* =============================================================
                  FORM ACTIONS - Always at bottom with border-t
                  ============================================================= */}
              <div className="flex items-center justify-end gap-4 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Create Item
                </Button>
              </div>
            </form>
          </Form>
        </FormContainer>
      </PageContainer>
    </PageShell>
  );
}
