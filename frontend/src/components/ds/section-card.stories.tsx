import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";
import { SectionCard } from "./section-card";

const meta: Meta<typeof SectionCard> = {
  title: "Layout/SectionCard",
  component: SectionCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof SectionCard>;

export const Default: Story = {
  args: {
    title: "Prime Contracts",
    children: (
      <div className="space-y-1">
        <SectionCard.Item
          title="General Contract — Vermillion Rise"
          subtitle="Pacific Construction Group"
          meta="$2,450,000"
          badge={<SectionCard.Badge variant="success">Active</SectionCard.Badge>}
        />
        <SectionCard.Item
          title="Design-Build Agreement"
          subtitle="Alleato Group LLC"
          meta="$180,000"
          badge={<SectionCard.Badge variant="warning">Pending</SectionCard.Badge>}
        />
      </div>
    ),
  },
};

export const WithAddAndViewAll: Story = {
  args: {
    title: "Subcontracts",
    onAdd: () => {},
    viewAllHref: "#",
    children: (
      <SectionCard.Item
        title="Mechanical — Pacific HVAC Inc."
        subtitle="SC-2024-042"
        meta="$485,000"
        badge={<SectionCard.Badge variant="brand">Executed</SectionCard.Badge>}
      />
    ),
  },
};

export const EmptyState: Story = {
  args: {
    title: "Change Orders",
    onAdd: () => {},
    children: (
      <SectionCard.Empty
        message="No change orders yet"
        description="Change orders will appear here once submitted."
        actionLabel="Add Change Order"
        onAction={() => {}}
      />
    ),
  },
};

export const Collapsed: Story = {
  args: {
    title: "Invoices",
    defaultOpen: false,
    children: <SectionCard.Item title="Invoice #INV-001" meta="$45,000" />,
  },
};

export const WithCustomHeader: Story = {
  args: {
    title: "Team Members",
    headerActions: (
      <div className="flex items-center gap-2">
        <StatusBadge status="active" />
      </div>
    ),
    children: (
      <SectionCard.Item title="Sarah Chen" subtitle="Project Manager" />
    ),
  },
};
