import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TextareaField } from "./TextareaField";

const meta: Meta<typeof TextareaField> = {
  title: "Inputs/TextareaField",
  component: TextareaField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof TextareaField>;

export const Default: Story = {
  args: {
    label: "Description",
    placeholder: "Enter a description...",
  },
};

export const Required: Story = {
  args: {
    label: "Scope of Work",
    required: true,
    placeholder: "Describe the scope of work in detail...",
    rows: 5,
  },
};

export const WithHint: Story = {
  args: {
    label: "Notes",
    hint: "Internal notes are not visible to the owner or subcontractor.",
    rows: 3,
  },
};

export const WithError: Story = {
  args: {
    label: "Change Order Reason",
    error: "A reason is required before submitting for approval.",
    rows: 3,
  },
};

export const WithValue: Story = {
  args: {
    label: "Additional Requirements",
    defaultValue:
      "All work to be performed during normal business hours (7am–5pm) Monday through Friday. Contractor must provide 48 hours notice before starting any noisy operations.",
    rows: 4,
  },
};
