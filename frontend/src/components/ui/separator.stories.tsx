import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Separator } from "./separator";

const meta: Meta = {
  title: "Utility/Separator",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Horizontal = {
  render: () => (
    <div className="space-y-4 w-80">
      <p className="text-sm">Contract Details</p>
      <Separator />
      <p className="text-sm text-muted-foreground">Schedule of Values</p>
    </div>
  ),
};

export const Vertical = {
  render: () => (
    <div className="flex h-8 items-center gap-3 text-sm">
      <span>Overview</span>
      <Separator orientation="vertical" />
      <span>Budget</span>
      <Separator orientation="vertical" />
      <span>Invoices</span>
    </div>
  ),
};
