import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Plus, Trash2, Settings } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Actions/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "ghost", "destructive", "secondary", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "xs", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Variants
export const Default: Story = {
  args: {
    children: "Button",
    variant: "default",
  },
};

export const Outline: Story = {
  args: {
    children: "Button",
    variant: "outline",
  },
};

export const Ghost: Story = {
  args: {
    children: "Button",
    variant: "ghost",
  },
};

export const Destructive: Story = {
  args: {
    children: "Delete",
    variant: "destructive",
  },
};

export const Secondary: Story = {
  args: {
    children: "Button",
    variant: "secondary",
  },
};

export const Link: Story = {
  args: {
    children: "Link Button",
    variant: "link",
  },
};

// Sizes
export const SizeDefault: Story = {
  name: "Size / Default",
  args: { children: "Default Size", size: "default" },
};

export const SizeSm: Story = {
  name: "Size / Small",
  args: { children: "Small", size: "sm" },
};

export const SizeLg: Story = {
  name: "Size / Large",
  args: { children: "Large", size: "lg" },
};

export const SizeIcon: Story = {
  name: "Size / Icon",
  args: {
    size: "icon",
    children: <Settings />,
    "aria-label": "Settings",
  },
};

// States
export const Disabled: Story = {
  args: {
    children: "Disabled",
    disabled: true,
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus />
        Add Item
      </>
    ),
    variant: "default",
    size: "sm",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">
        <Trash2 />
        Destructive
      </Button>
      <Button variant="link">Link</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};