import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";
import { DetailField, DetailFieldGrid } from "./DetailField";

const meta: Meta<typeof DetailField> = {
  title: "Inputs/DetailField",
  component: DetailField,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof DetailField>;

export const Default: Story = {
  args: {
    label: "Contract Type",
    value: "Lump Sum",
  },
};

export const Empty: Story = {
  args: {
    label: "Architect of Record",
    value: undefined,
  },
};

export const WithBadge: Story = {
  args: {
    label: "Status",
    value: <StatusBadge status="approved" />,
  },
};

export const LongValue: Story = {
  args: {
    label: "Description",
    value:
      "Provide all labor, materials, tools, equipment, and supervision required for the complete installation of the mechanical systems as specified in Section 15000.",
  },
};

export const GridLayout: Story = {
  name: "DetailFieldGrid",
  render: () => (
    <DetailFieldGrid cols={3}>
      <DetailField label="Contract No." value="SC-2024-042" />
      <DetailField label="Vendor" value="Pacific Mechanical Inc." />
      <DetailField label="Status" value={<StatusBadge status="active" />} />
      <DetailField label="Start Date" value="Jan 15, 2024" />
      <DetailField label="End Date" value="Dec 31, 2024" />
      <DetailField label="Contract Value" value="$1,250,000" />
      <DetailField label="Retainage" value="10%" />
      <DetailField label="Billed to Date" value="$387,500" />
      <DetailField label="Balance" value="$862,500" />
    </DetailFieldGrid>
  ),
};

export const TwoColGrid: Story = {
  name: "DetailFieldGrid (2 cols)",
  render: () => (
    <DetailFieldGrid cols={2}>
      <DetailField label="Owner" value="Vermillion Rise LLC" />
      <DetailField label="Project Manager" value="Sarah Chen" />
      <DetailField label="Phone" value="(415) 555-0123" />
      <DetailField label="Email" value="s.chen@alleato.com" />
    </DetailFieldGrid>
  ),
};
