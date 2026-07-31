import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { MetricCard, MetricGrid, MetricSummary } from "./metric-card";

const meta: Meta<typeof MetricCard> = {
  title: "Data Display/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    format: { control: "select", options: ["currency", "number", "percent", "none"] },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Default: Story = {
  args: {
    label: "Total Contract Value",
    value: 2450000,
    format: "currency",
  },
};

export const WithPositiveChange: Story = {
  args: {
    label: "Budget Remaining",
    value: 184200,
    format: "currency",
    change: { value: 12.4, type: "positive", label: "vs last month" },
  },
};

export const WithNegativeChange: Story = {
  args: {
    label: "Cost Overrun",
    value: 47500,
    format: "currency",
    change: { value: 8.2, type: "negative" },
  },
};

export const Percent: Story = {
  args: {
    label: "Budget Used",
    value: 68.4,
    format: "percent",
    subtitle: "$1,667,000 of $2,450,000",
    change: { value: 3.1, type: "negative" },
  },
};

export const Count: Story = {
  args: {
    label: "Open RFIs",
    value: 14,
    format: "number",
    subtitle: "3 overdue",
    change: { value: 2, type: "negative", label: "this week" },
  },
};

export const Small: Story = {
  args: {
    label: "Pending Invoices",
    value: 5,
    format: "number",
    size: "sm",
  },
};

export const Large: Story = {
  args: {
    label: "Project Value",
    value: 12500000,
    format: "currency",
    size: "lg",
    change: { value: 5.2, type: "positive" },
  },
};

export const WithAction: Story = {
  args: {
    label: "Outstanding Balance",
    value: 862500,
    format: "currency",
    action: <Button size="xs" variant="outline">View</Button>,
  },
};

export const GridLayout: Story = {
  name: "MetricGrid (4 cards)",
  render: () => (
    <MetricGrid cols={4}>
      <MetricCard label="Contract Value" value={2450000} format="currency" />
      <MetricCard label="Approved COs" value={84500} format="currency" change={{ value: 12, type: "positive" }} />
      <MetricCard label="Invoiced to Date" value={1200000} format="currency" subtitle="48.9% complete" />
      <MetricCard label="Remaining Balance" value={1165500} format="currency" />
    </MetricGrid>
  ),
};

export const SummaryInline: Story = {
  name: "MetricSummary (inline)",
  render: () => (
    <MetricSummary
      items={[
        { label: "Original Contract", value: 2450000, format: "currency" },
        { label: "Approved COs", value: 84500, format: "currency" },
        { label: "Revised Contract", value: 2534500, format: "currency" },
        { label: "% Complete", value: 48.9, format: "percent" },
      ]}
    />
  ),
};
