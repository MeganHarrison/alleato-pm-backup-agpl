import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { SectionRuleHeading } from "./spacing";

const meta: Meta<typeof SectionRuleHeading> = {
  title: "Layout/SectionRuleHeading",
  component: SectionRuleHeading,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof SectionRuleHeading>;

export const Default: Story = {
  args: {
    label: "Section Title",
  },
};

export const WithActions: Story = {
  args: {
    label: "Contract Details",
    actions: (
      <>
        <Button size="sm" variant="ghost">
          Cancel
        </Button>
        <Button size="sm">Save</Button>
      </>
    ),
  },
};

export const LongLabel: Story = {
  args: {
    label: "Financial Summary & Cost Breakdown",
  },
};

export const WithSingleAction: Story = {
  args: {
    label: "Line Items",
    actions: (
      <Button size="sm" variant="outline">
        + Add Item
      </Button>
    ),
  },
};

export const InContext: Story = {
  name: "In Context (with content below)",
  render: () => (
    <div className="space-y-6 max-w-2xl">
      <SectionRuleHeading label="Project Information" />
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Project name, description, and other details would appear here.</p>
        <p>This shows how the heading looks with actual content beneath it.</p>
      </div>
      <SectionRuleHeading
        label="Budget"
        actions={
          <Button size="sm" variant="outline">
            Edit
          </Button>
        }
      />
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Budget line items and financial data would appear here.</p>
      </div>
    </div>
  ),
};