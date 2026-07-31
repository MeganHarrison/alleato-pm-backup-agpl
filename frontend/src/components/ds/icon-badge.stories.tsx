import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  DollarSign,
  FileText,
  HardHat,
  Building2,
  ClipboardList,
  Wrench,
} from "lucide-react";
import { IconBadge } from "./icon-badge";

const meta: Meta<typeof IconBadge> = {
  title: "Typography/IconBadge",
  component: IconBadge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    size: { control: "select", options: ["sm", "md", "lg", "xl"] },
  },
};

export default meta;
type Story = StoryObj<typeof IconBadge>;

export const Default: Story = {
  args: {
    children: <DollarSign className="h-4 w-4" />,
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: <FileText className="h-3.5 w-3.5" />,
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: <Building2 className="h-5 w-5" />,
  },
};

export const ExtraLarge: Story = {
  args: {
    size: "xl",
    children: <HardHat className="h-6 w-6" />,
  },
};

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="flex items-end gap-4">
      <IconBadge size="sm"><FileText className="h-3.5 w-3.5" /></IconBadge>
      <IconBadge size="md"><ClipboardList className="h-4 w-4" /></IconBadge>
      <IconBadge size="lg"><Building2 className="h-5 w-5" /></IconBadge>
      <IconBadge size="xl"><Wrench className="h-6 w-6" /></IconBadge>
    </div>
  ),
};
