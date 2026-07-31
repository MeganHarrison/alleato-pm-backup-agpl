"use client";

import * as React from "react";
import { Form } from "@/components/forms/Form";
import { FormSection } from "@/components/forms/FormSection";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import { NumberField } from "@/components/forms/NumberField";
import { TextareaField } from "@/components/forms/TextareaField";
import { FileUploadField } from "@/components/forms/FileUploadField";
import { ScheduleOfValuesGrid } from "./ScheduleOfValuesGrid";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanies } from "@/hooks/use-companies";
import { useProjects } from "@/hooks/use-projects";

interface PurchaseOrderFormData {
  number: string;
  vendorId: string;
  projectId: string;
  status: string;
  issueDate?: Date;
  dueDate?: Date;
  amount: number;
  description: string;
  lineItems?: Array<{
    id: string;
    description: string;
    costCode?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  attachments?: Array<{
    name: string;
    size: number;
    type: string;
    url?: string;
  }>;
}

interface PurchaseOrderFormProps {
  initialData?: Partial<PurchaseOrderFormData>;
  onSubmit: (data: PurchaseOrderFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function PurchaseOrderForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: PurchaseOrderFormProps) {
  const [formData, setFormData] = React.useState<
    Partial<PurchaseOrderFormData>
  >(initialData || {});

  // Fetch vendors (companies) and projects from Supabase
  const { companies, isLoading: companiesLoading } = useCompanies();
  const { projects: projectData, isLoading: projectsLoading } = useProjects();

  // Transform companies to vendor options for dropdown
  const vendors = React.useMemo(() => {
    return companies.map((company) => ({
      value: company.id,
      label: company.name || "Unnamed Company",
    }));
  }, [companies]);

  // Transform projects to options for dropdown
  const projects = React.useMemo(() => {
    return projectData.map((project) => ({
      value: project.id.toString(),
      label: project.name || project.project_number || `Project #${project.id}`,
    }));
  }, [projectData]);

  const statuses = [
    { value: "draft", label: "Draft" },
    { value: "pending_approval", label: "Pending Approval" },
    { value: "approved", label: "Approved" },
    { value: "sent", label: "Sent to Vendor" },
    { value: "acknowledged", label: "Acknowledged" },
    { value: "completed", label: "Completed" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData as PurchaseOrderFormData);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="items">Line Items</TabsTrigger>
          <TabsTrigger value="attachments">Attachments</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <FormSection
            title="Purchase Order Details"
            description="Basic information about this purchase order"
          >
            <TextField
              label="PO Number"
              value={formData.number || ""}
              onChange={(e) =>
                setFormData({ ...formData, number: e.target.value })
              }
              required
              placeholder="Enter PO number"
            />

            <SelectField
              label="Vendor"
              options={vendors}
              value={formData.vendorId}
              onValueChange={(value) =>
                setFormData({ ...formData, vendorId: value })
              }
              placeholder={
                companiesLoading ? "Loading vendors..." : "Select vendor"
              }
              required
            />

            <SelectField
              label="Project"
              options={projects}
              value={formData.projectId}
              onValueChange={(value) =>
                setFormData({ ...formData, projectId: value })
              }
              placeholder={
                projectsLoading ? "Loading projects..." : "Select project"
              }
              required
            />

            <SelectField
              label="Status"
              options={statuses}
              value={formData.status || "draft"}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
              required
            />

            <DateField
              label="Issue Date"
              value={formData.issueDate}
              onChange={(date) => setFormData({ ...formData, issueDate: date })}
            />

            <DateField
              label="Due Date"
              value={formData.dueDate}
              onChange={(date) => setFormData({ ...formData, dueDate: date })}
              required
            />

            <NumberField
              label="Total Amount"
              value={formData.amount}
              onChange={(value) =>
                setFormData({ ...formData, amount: value || 0 })
              }
              required
              prefix="$"
              fullWidth
            />

            <TextareaField
              label="Description"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter purchase order description..."
              rows={3}
              fullWidth
            />
          </FormSection>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <ScheduleOfValuesGrid values={[]} onChange={() => {}} />
        </TabsContent>

        <TabsContent value="attachments" className="space-y-6">
          <FormSection title="Attachments">
            <FileUploadField
              value={formData.attachments || []}
              onChange={(files) =>
                setFormData({ ...formData, attachments: files })
              }
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              maxSize={10 * 1024 * 1024} // 10MB
              fullWidth
            />
          </FormSection>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 pt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Purchase Order"}
        </Button>
      </div>
    </Form>
  );
}
