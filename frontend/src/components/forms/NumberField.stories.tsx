import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NumberField } from "./NumberField";

const meta: Meta<typeof NumberField> = {
  title: "Inputs/NumberField",
  component: NumberField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof NumberField>;

export const Default: Story = {
  args: { label: "Quantity" },
};

export const Required: Story = {
  args: {
    label: "Square Footage",
    required: true,
    placeholder: "0",
  },
};

export const WithPrefix: Story = {
  args: {
    label: "Unit Price",
    prefix: "$",
    placeholder: "0.00",
  },
};

export const WithSuffix: Story = {
  args: {
    label: "Retainage",
    suffix: "%",
    placeholder: "10",
  },
};

export const WithHint: Story = {
  args: {
    label: "Liquidated Damages",
    prefix: "$",
    hint: "Daily rate applied for each calendar day of delay beyond the completion date.",
  },
};

export const WithError: Story = {
  args: {
    label: "Contract Value",
    prefix: "$",
    error: "Contract value must be greater than zero.",
    value: 0,
  },
};

export const Disabled: Story = {
  args: {
    label: "Original Contract Value",
    value: 2450000,
    disabled: true,
  },
};
