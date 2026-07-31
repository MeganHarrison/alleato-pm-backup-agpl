import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextField } from "./TextField";

const meta: Meta<typeof TextField> = {
  title: "Inputs/TextField",
  component: TextField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof TextField>;

export const Default: Story = {
  args: { label: "Vendor Name" },
};

export const WithPlaceholder: Story = {
  args: {
    label: "Project Name",
    placeholder: "e.g. Vermillion Rise Warehouse",
  },
};

export const Required: Story = {
  args: {
    label: "Contract Number",
    required: true,
    placeholder: "SC-2024-042",
  },
};

export const WithHint: Story = {
  args: {
    label: "Tax ID",
    hint: "Enter the vendor's federal tax identification number.",
    placeholder: "XX-XXXXXXX",
  },
};

export const WithError: Story = {
  args: {
    label: "Email Address",
    defaultValue: "not-an-email",
    error: "Please enter a valid email address.",
  },
};

export const Disabled: Story = {
  args: {
    label: "Project ID",
    defaultValue: "PRJ-67",
    disabled: true,
  },
};

export const FullWidth: Story = {
  render: () => (
    <div className="w-full max-w-lg">
      <TextField
        label="Description"
        fullWidth
        placeholder="Brief description of the scope of work..."
      />
    </div>
  ),
};
