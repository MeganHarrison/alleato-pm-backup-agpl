import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { KpiBlock, KpiRow } from "./kpi";

const meta: Meta<typeof KpiBlock> = {
  title: "Data Display/KpiBlock",
  component: KpiBlock,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["prominent", "compact"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof KpiBlock>;

export const Default: Story = {
  args: {
    label: "Total Contract Value",
    value: "$2,450,000",
    size: "prominent",
  },
};

export const WithDeltaPositive: Story = {
  args: {
    label: "Budget Remaining",
    value: "$184,200",
    delta: {
      value: "+12.4%",
      positive: true,
    },
    context: "vs. last month",
    size: "prominent",
  },
};

export const WithDeltaNegative: Story = {
  args: {
    label: "Cost to Complete",
    value: "$340,000",
    delta: {
      value: "-8.2%",
      positive: false,
    },
    context: "budget variance",
    size: "prominent",
  },
};

export const Compact: Story = {
  args: {
    label: "Open RFIs",
    value: "14",
    size: "compact",
    context: "3 overdue",
  },
};

export const WithProgress: Story = {
  args: {
    label: "Budget Used",
    value: "68%",
    size: "prominent",
    context: "$1,667,000 of $2,450,000",
    progress: {
      value: 68,
      tone: "neutral",
    },
  },
};

export const WithProgressWarning: Story = {
  args: {
    label: "Contingency Used",
    value: "82%",
    size: "prominent",
    progress: {
      value: 82,
      tone: "warning",
    },
  },
};

export const WithProgressDanger: Story = {
  args: {
    label: "Budget Overrun",
    value: "107%",
    size: "prominent",
    progress: {
      value: 100,
      tone: "danger",
    },
  },
};

export const KpiRowExample: Story = {
  name: "KpiRow (4 metrics)",
  render: () => (
    <KpiRow
      metrics={[
        {
          label: "Contract Value",
          value: "$2,450,000",
          size: "prominent",
        },
        {
          label: "Approved COs",
          value: "$84,500",
          delta: { value: "+$12,000", positive: true },
          size: "prominent",
        },
        {
          label: "Invoiced to Date",
          value: "$1,200,000",
          context: "48.9% complete",
          progress: { value: 49, tone: "neutral" },
          size: "prominent",
        },
        {
          label: "Remaining",
          value: "$1,165,500",
          size: "prominent",
        },
      ]}
    />
  ),
};

export const KpiRowThreeMetrics: Story = {
  name: "KpiRow (3 metrics)",
  render: () => (
    <KpiRow
      metrics={[
        { label: "Open RFIs", value: "14", context: "3 overdue", size: "compact" },
        { label: "Submittals", value: "42", context: "8 pending", size: "compact" },
        { label: "Change Events", value: "7", context: "2 in review", size: "compact" },
      ]}
    />
  ),
};