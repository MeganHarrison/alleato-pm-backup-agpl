import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { CompactSectionHeader } from "./compact-section-header";

const meta: Meta = {
  title: "Layout/CompactSectionHeader",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <div className="w-80">
      <CompactSectionHeader>Change Orders</CompactSectionHeader>
      <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
        Content below header
      </div>
    </div>
  ),
};

export const WithAction = {
  render: () => (
    <div className="w-80">
      <CompactSectionHeader
        action={<Button size="xs" variant="ghost">+ Add</Button>}
      >
        Subcontracts
      </CompactSectionHeader>
      <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
        Content below header
      </div>
    </div>
  ),
};

export const InContext = {
  name: "Multiple sections",
  render: () => (
    <div className="w-80 space-y-6">
      {["Financial Summary", "Team Members", "Recent Activity"].map((title) => (
        <div key={title}>
          <CompactSectionHeader>{title}</CompactSectionHeader>
          <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
            {title} content
          </div>
        </div>
      ))}
    </div>
  ),
};
