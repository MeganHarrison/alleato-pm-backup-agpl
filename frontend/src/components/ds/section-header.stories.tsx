import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "./section-header";

const meta: Meta<typeof SectionHeader> = {
  title: "Layout/SectionHeader",
  component: SectionHeader,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: {
    title: "Change Orders",
  },
};

export const WithCount: Story = {
  args: {
    title: "Subcontracts",
    count: 12,
  },
};

export const WithLinkAction: Story = {
  args: {
    title: "Recent Invoices",
    count: 5,
    action: { label: "View all", href: "#" },
  },
};

export const WithClickAction: Story = {
  args: {
    title: "Team Members",
    count: 8,
    action: { label: "+ Add member", onClick: () => {} },
  },
};

export const WithButtonNode: Story = {
  args: {
    title: "Budget Line Items",
    count: 34,
    action: <Button size="sm">+ Add Line Item</Button>,
  },
};

export const NoCount: Story = {
  args: {
    title: "Project Notes",
    action: { label: "Add note", onClick: () => {} },
  },
};
