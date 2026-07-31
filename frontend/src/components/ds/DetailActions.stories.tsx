import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Archive, Download } from "lucide-react";
import { DetailActions } from "./DetailActions";

const meta: Meta<typeof DetailActions> = {
  title: "Actions/DetailActions",
  component: DetailActions,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DetailActions>;

export const EditOnly: Story = {
  args: {
    onEdit: () => {},
  },
};

export const EditAndDelete: Story = {
  args: {
    onEdit: () => {},
    onDelete: () => {},
  },
};

export const AllActions: Story = {
  args: {
    onEdit: () => {},
    onShare: () => {},
    onDelete: () => {},
  },
};

export const WithExtraActions: Story = {
  args: {
    onEdit: () => {},
    onDelete: () => {},
    extraActions: [
      { label: "Download PDF", icon: <Download className="h-4 w-4" />, onClick: () => {} },
      { label: "Archive", icon: <Archive className="h-4 w-4" />, onClick: () => {} },
    ],
  },
};

export const DestructiveExtra: Story = {
  args: {
    onEdit: () => {},
    extraActions: [
      { label: "Void Contract", onClick: () => {}, destructive: true },
    ],
    onDelete: () => {},
  },
};
