import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RichTextField } from "./RichTextField";

const meta: Meta<typeof RichTextField> = {
  title: "Inputs/RichTextField",
  component: RichTextField,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof RichTextField>;

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
    placeholder: "Describe the full scope of work...",
  },
};

export const WithValue: Story = {
  args: {
    label: "Change Order Description",
    value:
      "<p>Owner requested expedited delivery on <strong>framing materials</strong> due to weather delays.</p><ul><li>Additional material cost: $8,500</li><li>Expedited delivery fee: $4,000</li></ul><p>Total additional cost: <strong>$12,500</strong></p>",
  },
};

export const WithHint: Story = {
  args: {
    label: "Special Conditions",
    hint: "Use formatting to highlight key requirements or deadlines.",
  },
};

export const WithError: Story = {
  args: {
    label: "Justification",
    required: true,
    error: "A written justification is required for changes over $10,000.",
  },
};
