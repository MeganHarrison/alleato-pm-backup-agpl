import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";
import { DataTable } from "./data-table";

const meta: Meta<typeof DataTable> = {
  title: "Data Display/DataTable",
  component: DataTable,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof DataTable>;

const commitmentRows = [
  { id: 1, number: "SC-042", vendor: "Pacific Mechanical Inc.", value: "$485,000", status: "active" },
  { id: 2, number: "SC-043", vendor: "West Coast Electrical", value: "$312,000", status: "approved" },
  { id: 3, number: "SC-044", vendor: "Atlas Concrete Group", value: "$198,000", status: "pending" },
  { id: 4, number: "SC-045", vendor: "Premier Glass & Glazing", value: "$145,000", status: "draft" },
];

export const Default: Story = {
  render: () => (
    <DataTable
      columns={[
        { key: "number", header: "Number", primary: true, render: (r) => r.number },
        { key: "vendor", header: "Vendor", render: (r) => r.vendor },
        { key: "value", header: "Value", align: "right", render: (r) => r.value },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusBadge status={r.status} />,
        },
      ]}
      rows={commitmentRows}
    />
  ),
};

export const Clickable: Story = {
  render: () => (
    <DataTable
      columns={[
        { key: "number", header: "Number", primary: true, render: (r) => r.number },
        { key: "vendor", header: "Vendor", render: (r) => r.vendor },
        { key: "value", header: "Value", align: "right", render: (r) => r.value },
        {
          key: "status",
          header: "Status",
          render: (r) => <StatusBadge status={r.status} />,
        },
      ]}
      rows={commitmentRows}
      onRowClick={(row) => alert(`Clicked: ${row.number}`)}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      columns={[
        { key: "number", header: "Number", primary: true, render: (r) => r },
        { key: "vendor", header: "Vendor", render: (r) => r },
      ]}
      rows={[]}
      emptyMessage="No subcontracts found for this project."
    />
  ),
};
