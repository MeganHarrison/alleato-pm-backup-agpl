"use client"

import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { PageContainer, PageHeader, FormContainer, PageShell } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"

import { FormSection } from "@/components/forms/FormSection"
import { FormGrid } from "@/components/forms/FormGrid"
import { FormActions } from "@/components/forms/FormActions"
import { FormServerError } from "@/components/forms/FormServerError"

import { RHFTextField } from "@/components/forms/fields/RHFTextField"
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField"
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField"
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField"
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField"
import { RHFDateField } from "@/components/forms/fields/RHFDateField"
import { RHFMoneyField } from "@/components/forms/fields/RHFMoneyField"
import { RHFComboboxField } from "@/components/forms/fields/RHFComboboxField"
import { RHFFieldArrayTable } from "@/components/forms/fields/RHFFieldArrayTable"

import { buildOptions } from "@/components/forms/utils/buildOptions"

const TYPE_VALUES = ["type_a", "type_b", "type_c"] as const
const STATUS_VALUES = ["draft", "pending", "approved"] as const

const TYPE_OPTIONS = buildOptions(TYPE_VALUES, {
  type_a: "Type A",
  type_b: "Type B",
  type_c: "Type C",
})

const STATUS_OPTIONS = buildOptions(STATUS_VALUES, {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
})

const ASSIGNEE_OPTIONS = [
  { value: "sarah", label: "Sarah Johnson", keywords: ["pm", "project manager"] },
  { value: "michael", label: "Michael Lee", keywords: ["operations", "ops"] },
  { value: "jessica", label: "Jessica Brown", keywords: ["finance", "accounting"] },
]

const lineItemSchema = z.object({
  itemName: z.string().trim().min(1, "Item name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  unitCost: z.number().min(0, "Unit cost must be 0 or greater"),
})

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(TYPE_VALUES),
  date: z.string().trim().min(1, "Date is required"),
  description: z.string().trim().optional(),
  amount: z.number().min(0, "Amount must be 0 or greater"),
  budget: z.number().min(0, "Budget must be 0 or greater"),
  status: z.enum(STATUS_VALUES),
  isBillable: z.boolean(),
  assignee: z.string().min(1, "Assignee is required"),
  notes: z.string().trim().optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
})

type FormValues = z.infer<typeof formSchema>

function createLineItem() {
  return {
    itemName: "",
    quantity: 1,
    unitCost: 0,
  }
}

export default function StandardFormPage() {
  const router = useRouter()
  const params = useParams()!
  const projectId = params.projectId as string

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      type: "type_a",
      date: new Date().toISOString().split("T")[0],
      description: "",
      amount: 0,
      budget: 0,
      status: "draft",
      isBillable: false,
      assignee: "",
      notes: "",
      lineItems: [createLineItem()],
    },
  })

  const {
    control,
    handleSubmit,
    setError,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const watchedLineItems = watch("lineItems")

  const lineItemTotal =
    watchedLineItems?.reduce((sum, item) => {
      const quantity = Number(item?.quantity ?? 0)
      const unitCost = Number(item?.unitCost ?? 0)
      return sum + quantity * unitCost
    }, 0) ?? 0

  async function onSubmit(data: FormValues) {
    try {
      const response = await fetch(`/api/projects/${projectId}/your-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const message = "Failed to save item"
        setError("root", { type: "server", message })
        toast.error(message)
        return
      }

      toast.success("Item created successfully")
      router.push(`/${projectId}/your-list`)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong"
      setError("root", { type: "server", message })
      toast.error(message)
    }
  }

  function handleCancel() {
    router.push(`/${projectId}/your-list`)
  }

  return (
    <PageShell variant="form" title="Create New Item">
    <PageContainer>
      <PageHeader
        title="Create New Item"
        description="Example template showing every standard form field pattern"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            <ArrowLeft />
            Back to List
          </Button>
        }
      />

      <section className="mb-8 rounded-lg border border-border bg-muted/20 p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">Form System Migration Status (March 10, 2026)</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Direct Costs line item table now matches Change Events styling, including in-table totals row placement.</li>
          <li>Create New Budget Code now uses the real budget modal in Direct Costs and Change Events.</li>
          <li>Newly created budget code auto-selects back into the exact line item row that launched the modal.</li>
          <li>Same-page edit mode is live for Change Events, Commitments, Prime Contracts, and Change Orders.</li>
          <li>Legacy /edit routes now redirect to detail pages using ?edit=1 and are no longer maintenance surfaces.</li>
          <li>Fields standardized with shared form sections/grids/actions and modernized attachments in migrated forms.</li>
        </ul>
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-background">
          <img
            src="/images/docs/form-system-direct-costs-2026-03-10.png"
            alt="Direct Costs form using updated form-system styling and line item totals row"
            className="h-auto w-full"
          />
        </div>
      </section>

      <FormContainer maxWidth="lg" withCard={false}>
        <Form {...form}>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <FormSection
              title="Basic Information"
              description="Standard examples for common field types"
            >
              <FormGrid columns={2}>
                <RHFTextField
                  control={control}
                  name="name"
                  label="Name *"
                  placeholder="Enter name"
                />

                <RHFSelectField
                  control={control}
                  name="type"
                  label="Type *"
                  placeholder="Select type"
                  options={TYPE_OPTIONS}
                />

                <RHFDateField
                  control={control}
                  name="date"
                  label="Date *"
                  description="Standard date input example"
                />

                <RHFNumberField
                  control={control}
                  name="amount"
                  label="Amount"
                  placeholder=""
                  min={0}
                  step={0.01}
                  description="Standard number input example"
                />
              </FormGrid>

              <RHFTextareaField
                control={control}
                name="description"
                label="Description"
                placeholder="Enter a description..."
                rows={3}
                description="Standard textarea example"
              />
            </FormSection>

            <FormSection
              title="Advanced Inputs"
              description="Examples of the richer field components"
            >
              <FormGrid columns={2}>
                <RHFMoneyField
                  control={control}
                  name="budget"
                  label="Budget"
                  placeholder=""
                  min={0}
                  description="Currency input example"
                />

                <RHFComboboxField
                  control={control}
                  name="assignee"
                  label="Assignee"
                  placeholder="Select assignee"
                  searchPlaceholder="Search team members..."
                  emptyMessage="No team members found."
                  options={ASSIGNEE_OPTIONS}
                  description="Searchable combobox example"
                />

                <RHFSelectField
                  control={control}
                  name="status"
                  label="Status"
                  placeholder="Select status"
                  options={STATUS_OPTIONS}
                  description="Standard select example"
                />

                <RHFCheckboxField
                  control={control}
                  name="isBillable"
                  label="Billable item"
                  description="Checkbox example"
                />
              </FormGrid>

              <RHFTextareaField
                control={control}
                name="notes"
                label="Notes"
                placeholder="Any additional notes..."
                rows={4}
                description="Optional notes"
              />
            </FormSection>

            <FormSection
              title="Line Items Table"
              description="Reusable RHF field-array table example"
            >
              <RHFFieldArrayTable
                control={control}
                name="lineItems"
                label="Line Items"
                description="Add one or more line items"
                addLabel="Add Line Item"
                createRow={createLineItem}
                columns={[
                  {
                    key: "itemName",
                    header: "Item Name",
                    mobileLabel: "Item Name",
                    className: "min-w-[220px]",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.itemName`}
                        label="Item Name"
                        placeholder="Enter item name"
                      />
                    ),
                  },
                  {
                    key: "quantity",
                    header: "Quantity",
                    mobileLabel: "Quantity",
                    className: "w-[160px]",
                    cell: ({ rowName }) => (
                      <RHFNumberField
                        control={control}
                        name={`${rowName}.quantity`}
                        label="Quantity"
                        min={1}
                        step={1}
                        placeholder="1"
                      />
                    ),
                  },
                  {
                    key: "unitCost",
                    header: "Unit Cost",
                    mobileLabel: "Unit Cost",
                    className: "w-[200px]",
                    cell: ({ rowName }) => (
                      <RHFMoneyField
                        control={control}
                        name={`${rowName}.unitCost`}
                        label="Unit Cost"
                        min={0}
                        placeholder=""
                      />
                    ),
                  },
                ]}
              />

              <div className="flex justify-end border-t pt-4">
                <div className="text-sm font-medium">
                  Total:{" "}
                  <span className="tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(lineItemTotal)}
                  </span>
                </div>
              </div>
            </FormSection>

            <FormServerError message={errors.root?.message} />

            <FormActions
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              submitLabel="Create Item"
              stickyOnMobile
            />
          </form>
        </Form>
      </FormContainer>
    </PageContainer>
    </PageShell>
  )
}
