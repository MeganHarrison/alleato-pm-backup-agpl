import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  HardHat,
  Building2,
  ClipboardList,
  FileStack,
  Hammer,
  Search,
  FolderOpen,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "Feedback/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    backgrounds: { default: "surface" },
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    icon: <HardHat />,
    title: "No items found",
    description: "There are no items to display yet. Create one to get started.",
  },
};

export const Commitments: Story = {
  args: {
    icon: <ClipboardList />,
    title: "No commitments yet",
    description: "Subcontracts and purchase orders will appear here once they're created.",
    action: <Button size="sm">+ New Commitment</Button>,
  },
};

export const ChangeOrders: Story = {
  args: {
    icon: <Hammer />,
    title: "No change orders yet",
    description: "Change orders will appear here once they're submitted for review.",
    action: <Button size="sm">+ New Change Order</Button>,
  },
};

export const Budget: Story = {
  args: {
    icon: <Building2 />,
    title: "Budget not configured",
    description: "Set up your project budget to track costs and forecast spend across all line items.",
    action: <Button size="sm">Configure Budget</Button>,
  },
};

export const Documents: Story = {
  args: {
    icon: <FileStack />,
    title: "No documents uploaded",
    description: "Upload contracts, drawings, or specs to keep everything in one place.",
    action: <Button size="sm">Upload Document</Button>,
  },
};

export const Invoices: Story = {
  args: {
    icon: <Receipt />,
    title: "No invoices yet",
    description: "Invoices will appear here as they're submitted by subcontractors.",
  },
};

export const SearchEmpty: Story = {
  args: {
    icon: <Search />,
    title: "No results",
    description: "We couldn't find anything matching your search. Try different keywords or clear your filters.",
    action: <Button variant="outline" size="sm">Clear Search</Button>,
  },
};

export const NoIcon: Story = {
  args: {
    title: "Nothing here yet",
    description: "Items will appear once they've been created.",
  },
};

export const FolderEmpty: Story = {
  args: {
    icon: <FolderOpen />,
    title: "This folder is empty",
    description: "Move files here to organise your project documents.",
    action: <Button variant="outline" size="sm">Upload Files</Button>,
  },
};