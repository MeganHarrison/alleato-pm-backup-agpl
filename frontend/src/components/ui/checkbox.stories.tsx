import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Checkbox } from "./checkbox";

const meta: Meta = {
  title: "Inputs/Checkbox",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <Checkbox />,
};

export const Checked = {
  render: () => <Checkbox defaultChecked />,
};

export const WithLabel = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <Label htmlFor="terms">I confirm this invoice is accurate</Label>
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="disabled" disabled />
      <Label htmlFor="disabled" className="opacity-50">Disabled checkbox</Label>
    </div>
  ),
};

export const DisabledChecked = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="disabled-checked" disabled defaultChecked />
      <Label htmlFor="disabled-checked" className="opacity-50">Already approved</Label>
    </div>
  ),
};

export const List = {
  render: () => (
    <div className="space-y-3">
      {["Include retainage", "Apply stored materials", "Include pending COs", "Override billing period"].map((label) => (
        <div key={label} className="flex items-center gap-2">
          <Checkbox id={label} />
          <Label htmlFor={label}>{label}</Label>
        </div>
      ))}
    </div>
  ),
};
