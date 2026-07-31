import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";

const meta: Meta<typeof StatusBadge> = {
  title: "Data Display/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Pending: Story = {
  args: { status: "pending" },
};

export const Approved: Story = {
  args: { status: "approved" },
};

export const Rejected: Story = {
  args: { status: "rejected" },
};

export const Draft: Story = {
  args: { status: "draft" },
};

export const Active: Story = {
  args: { status: "active" },
};

export const Inactive: Story = {
  args: { status: "inactive" },
};

export const Closed: Story = {
  args: { status: "closed" },
};

export const Void: Story = {
  args: { status: "void" },
};

export const Submitted: Story = {
  args: { status: "submitted" },
};

export const InProgress: Story = {
  args: { status: "in progress" },
};

export const AllStatuses: Story = {
  name: "All Statuses",
  render: () => (
    <div className="flex flex-wrap gap-2">
      {[
        "pending",
        "approved",
        "rejected",
        "draft",
        "active",
        "inactive",
        "closed",
        "void",
        "submitted",
        "in progress",
        "completed",
        "open",
        "cancelled",
        "overdue",
        "archived",
      ].map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};