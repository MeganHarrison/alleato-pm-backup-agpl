import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { TextField } from "./TextField";
import { DateField } from "./DateField";
import { SelectField } from "./SelectField";
import { FormGrid } from "./FormGrid";
import { FormSection } from "./FormSection";

const meta: Meta = {
  title: "Layout/FormSection",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <FormSection title="Contract Details" description="Enter the basic contract information.">
      <FormGrid columns={2}>
        <TextField label="Contract Number" placeholder="SC-2024-042" required />
        <SelectField
          label="Contract Type"
          options={[
            { value: "lump-sum", label: "Lump Sum" },
            { value: "cost-plus", label: "Cost Plus" },
            { value: "gmp", label: "GMP" },
          ]}
        />
        <TextField label="Vendor Name" required />
        <TextField label="Contract Value" placeholder="" />
      </FormGrid>
    </FormSection>
  ),
};

export const MultiSection = {
  render: () => (
    <div>
      <FormSection title="General Information" description="Basic project and contract details.">
        <FormGrid columns={2}>
          <TextField label="Project Name" required />
          <TextField label="Project Number" />
        </FormGrid>
      </FormSection>
      <FormSection title="Contract Terms" description="Define the financial terms of the agreement.">
        <FormGrid columns={2}>
          <TextField label="Contract Value" prefix="$" />
          <TextField label="Retainage Percentage" placeholder="0%" inputMode="decimal" />
        </FormGrid>
      </FormSection>
      <FormSection title="Schedule" description="Set the project timeline.">
        <FormGrid columns={2}>
          <DateField label="Start Date" />
          <DateField label="Completion Date" />
        </FormGrid>
      </FormSection>
    </div>
  ),
};

export const Compact = {
  render: () => (
    <FormSection
      title="Quick Details"
      spacing="compact"
      description="Compact spacing for dense forms."
    >
      <FormGrid columns={2}>
        <TextField label="Reference #" />
        <TextField label="Amount" />
      </FormGrid>
    </FormSection>
  ),
};
