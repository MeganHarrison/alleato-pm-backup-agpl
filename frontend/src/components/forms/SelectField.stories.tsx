import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SelectField } from "./SelectField";

const meta: Meta<typeof SelectField> = {
  title: "Inputs/SelectField",
  component: SelectField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof SelectField>;

const contractTypes = [
  { value: "lump-sum", label: "Lump Sum" },
  { value: "cost-plus", label: "Cost Plus" },
  { value: "gmp", label: "GMP (Guaranteed Maximum Price)" },
  { value: "unit-price", label: "Unit Price" },
  { value: "time-materials", label: "Time & Materials" },
];

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "void", label: "Void" },
];

export const Default: Story = {
  args: {
    label: "Contract Type",
    options: contractTypes,
    placeholder: "Select contract type",
  },
};

export const Required: Story = {
  args: {
    label: "Status",
    options: statusOptions,
    required: true,
    placeholder: "Select a status",
  },
};

export const WithValue: Story = {
  args: {
    label: "Contract Type",
    options: contractTypes,
    value: "lump-sum",
  },
};

export const WithHint: Story = {
  args: {
    label: "Billing Type",
    options: [
      { value: "monthly", label: "Monthly" },
      { value: "milestone", label: "Milestone-based" },
      { value: "percent-complete", label: "Percent Complete" },
    ],
    hint: "Determines how pay applications will be structured.",
  },
};

export const WithError: Story = {
  args: {
    label: "Cost Code",
    options: contractTypes,
    error: "You must select a cost code before saving.",
  },
};

export const Disabled: Story = {
  args: {
    label: "Contract Type",
    options: contractTypes,
    value: "lump-sum",
    disabled: true,
  },
};
