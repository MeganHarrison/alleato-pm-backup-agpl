import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { NumberInput } from "./number-input";

const meta: Meta = {
  title: "Inputs/NumberInput",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <NumberInput className="w-48" />,
};

export const WithLabel = {
  render: () => (
    <div className="space-y-1.5 w-48">
      <Label>Square Footage</Label>
      <NumberInput defaultValue="150000" decimals={0} />
    </div>
  ),
};

export const WithDecimals = {
  render: () => (
    <div className="space-y-1.5 w-48">
      <Label>Unit Cost</Label>
      <NumberInput defaultValue="24.50" decimals={2} />
    </div>
  ),
};

export const Integer = {
  render: () => (
    <div className="space-y-1.5 w-48">
      <Label>Quantity</Label>
      <NumberInput defaultValue="42" decimals={0} placeholder="Enter quantity" />
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <NumberInput defaultValue="1250000" disabled className="w-48" />
  ),
};
