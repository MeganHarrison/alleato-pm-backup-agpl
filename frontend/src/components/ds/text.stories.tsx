import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Text } from "./text";

const meta: Meta<typeof Text> = {
  title: "Typography/Text",
  component: Text,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    size: { control: "select", options: ["xs", "sm", "base", "lg", "xl", "2xl"] },
    tone: { control: "select", options: ["default", "muted", "accent", "destructive", "success", "warning"] },
    weight: { control: "select", options: ["normal", "medium", "semibold", "bold"] },
    as: { control: "select", options: ["p", "span", "div", "label"] },
  },
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {
  args: {
    children: "Default body text for general content.",
  },
};

export const Muted: Story = {
  args: {
    tone: "muted",
    children: "Muted text used for secondary information or descriptions.",
  },
};

export const Destructive: Story = {
  args: {
    tone: "destructive",
    children: "Error or destructive action message.",
  },
};

export const Success: Story = {
  args: {
    tone: "success",
    children: "Change order approved and executed.",
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    children: "Budget threshold exceeded. Review before approving.",
  },
};

export const SmallMuted: Story = {
  args: {
    size: "sm",
    tone: "muted",
    children: "Small muted text — used in table cells and detail fields.",
  },
};

export const Semibold: Story = {
  args: {
    weight: "semibold",
    children: "Semibold label text.",
  },
};

export const AllTones: Story = {
  name: "All Tones",
  render: () => (
    <div className="space-y-2">
      <Text tone="default">Default — primary content</Text>
      <Text tone="muted">Muted — secondary content</Text>
      <Text tone="destructive">Destructive — errors and warnings</Text>
      <Text tone="success">Success — confirmations</Text>
      <Text tone="warning">Warning — caution messages</Text>
    </div>
  ),
};

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div className="space-y-2">
      <Text size="xs">xs — 12px caption text</Text>
      <Text size="sm">sm — 14px body text</Text>
      <Text size="base">base — 16px default</Text>
      <Text size="lg">lg — 18px prominent</Text>
      <Text size="xl">xl — 20px large</Text>
      <Text size="2xl">2xl — 24px heading-weight</Text>
    </div>
  ),
};
