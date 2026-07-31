import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Sparkles, HardHat, Zap, Shield } from "lucide-react";
import { PageBadge } from "./page-badge";

const meta: Meta<typeof PageBadge> = {
  title: "Typography/PageBadge",
  component: PageBadge,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof PageBadge>;

export const Default: Story = {
  args: {
    children: "AI-powered documentation",
  },
};

export const WithIcon: Story = {
  args: {
    icon: <Sparkles className="h-3.5 w-3.5" />,
    children: "AI Assistant",
  },
};

export const Construction: Story = {
  args: {
    icon: <HardHat className="h-3.5 w-3.5" />,
    children: "Construction Management",
  },
};

export const AllVariants: Story = {
  name: "Examples",
  render: () => (
    <div className="flex flex-col items-start gap-3">
      <PageBadge icon={<Sparkles className="h-3.5 w-3.5" />}>AI-powered</PageBadge>
      <PageBadge icon={<HardHat className="h-3.5 w-3.5" />}>Construction</PageBadge>
      <PageBadge icon={<Zap className="h-3.5 w-3.5" />}>Fast Track</PageBadge>
      <PageBadge icon={<Shield className="h-3.5 w-3.5" />}>Compliance</PageBadge>
      <PageBadge>No icon</PageBadge>
    </div>
  ),
};
