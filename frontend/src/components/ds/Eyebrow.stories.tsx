import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Eyebrow } from "./eyebrow";

const meta: Meta<typeof Eyebrow> = {
  title: "Typography/Eyebrow",
  component: Eyebrow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof Eyebrow>;

export const Default: Story = {
  args: {
    children: "Section Label",
  },
};

export const Primary: Story = {
  args: {
    children: "Primary Color Label",
    className: "text-primary",
  },
};

export const LongLabel: Story = {
  args: {
    children: "Contract Information & Details",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="space-y-4">
      <div>
        <Eyebrow>Default Muted Label</Eyebrow>
        <p className="text-sm text-foreground mt-1">Content that follows the label</p>
      </div>
      <div>
        <Eyebrow className="text-primary">Primary Colored Label</Eyebrow>
        <p className="text-sm text-foreground mt-1">Content that follows the label</p>
      </div>
    </div>
  ),
};