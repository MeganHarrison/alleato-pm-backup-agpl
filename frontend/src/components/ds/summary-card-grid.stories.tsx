import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DollarSign, FileText, Clock, CheckCircle } from "lucide-react";
import { SummaryCardGrid } from "./summary-card-grid";

const meta: Meta<typeof SummaryCardGrid> = {
  title: "Data Display/SummaryCardGrid",
  component: SummaryCardGrid,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SummaryCardGrid>;

export const Default: Story = {
  args: {
    cards: [
      { id: "total", label: "Total Contract Value", value: "$2,450,000" },
      { id: "invoiced", label: "Invoiced to Date", value: "$1,200,000" },
      { id: "remaining", label: "Remaining Balance", value: "$1,250,000" },
      { id: "overdue", label: "Overdue Invoices", value: 3 },
    ],
  },
};

export const WithChanges: Story = {
  args: {
    cards: [
      {
        id: "budget",
        label: "Total Budget",
        value: "$5,200,000",
        change: { value: 5.2, direction: "up" },
        icon: <DollarSign className="h-5 w-5" />,
      },
      {
        id: "committed",
        label: "Committed Costs",
        value: "$3,840,000",
        change: { value: 12.1, direction: "up" },
        icon: <FileText className="h-5 w-5" />,
      },
      {
        id: "pending",
        label: "Pending Approval",
        value: 7,
        subtitle: "Change orders",
        change: { value: 3, direction: "up", upIsGood: false },
        icon: <Clock className="h-5 w-5" />,
      },
      {
        id: "approved",
        label: "Approved This Month",
        value: 14,
        change: { value: 8, direction: "up" },
        icon: <CheckCircle className="h-5 w-5" />,
      },
    ],
  },
};

export const TwoColumns: Story = {
  args: {
    columns: 2,
    cards: [
      { id: "a", label: "Original Contract", value: "$2,450,000" },
      { id: "b", label: "Revised Contract", value: "$2,534,500" },
    ],
  },
};

export const ThreeColumns: Story = {
  args: {
    columns: 3,
    size: "sm",
    cards: [
      { id: "a", label: "Open RFIs", value: 14 },
      { id: "b", label: "Submittals Pending", value: 8 },
      { id: "c", label: "Change Events", value: 5 },
    ],
  },
};

export const Clickable: Story = {
  args: {
    cards: [
      { id: "a", label: "Total Budget", value: "$5.2M", onClick: () => {} },
      { id: "b", label: "Committed", value: "$3.8M", onClick: () => {} },
      { id: "c", label: "Actual Costs", value: "$2.1M", onClick: () => {} },
    ],
  },
};
