import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Data Display/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "destructive",
        "outline",
        "success",
        "warning",
        "active",
        "inactive",
        "admin",
        "project-manager",
        "superintendent",
        "foreman",
        "viewer",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "Badge",
    variant: "default",
  },
};

export const Secondary: Story = {
  args: {
    children: "Secondary",
    variant: "secondary",
  },
};

export const Destructive: Story = {
  args: {
    children: "Destructive",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "Outline",
    variant: "outline",
  },
};

export const Success: Story = {
  args: {
    children: "Success",
    variant: "success",
  },
};

export const Warning: Story = {
  args: {
    children: "Warning",
    variant: "warning",
  },
};

export const Active: Story = {
  args: {
    children: "Active",
    variant: "active",
  },
};

export const Inactive: Story = {
  args: {
    children: "Inactive",
    variant: "inactive",
  },
};

export const RoleAdmin: Story = {
  name: "Role / Admin",
  args: {
    children: "Admin",
    variant: "admin",
  },
};

export const RoleProjectManager: Story = {
  name: "Role / Project Manager",
  args: {
    children: "Project Manager",
    variant: "project-manager",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="active">Active</Badge>
      <Badge variant="inactive">Inactive</Badge>
      <Badge variant="admin">Admin</Badge>
      <Badge variant="project-manager">Project Manager</Badge>
      <Badge variant="superintendent">Superintendent</Badge>
      <Badge variant="foreman">Foreman</Badge>
      <Badge variant="viewer">Viewer</Badge>
    </div>
  ),
};