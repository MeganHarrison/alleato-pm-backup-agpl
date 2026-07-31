import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta: Meta = {
  title: "Typography/Label",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <Label>Contract Number</Label>,
};

export const WithInput = {
  render: () => (
    <div className="space-y-1.5 w-64">
      <Label htmlFor="contract-no">Contract Number</Label>
      <Input id="contract-no" placeholder="SC-2024-042" />
    </div>
  ),
};

export const Required = {
  render: () => (
    <div className="space-y-1.5 w-64">
      <Label htmlFor="vendor">
        Vendor <span className="text-destructive">*</span>
      </Label>
      <Input id="vendor" placeholder="Select vendor..." />
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <div className="space-y-1.5 w-64 opacity-50">
      <Label htmlFor="project-id">Project ID</Label>
      <Input id="project-id" value="PRJ-67" disabled />
    </div>
  ),
};
