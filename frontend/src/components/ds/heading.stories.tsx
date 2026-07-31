import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Heading } from "./heading";

const meta: Meta<typeof Heading> = {
  title: "Typography/Heading",
  component: Heading,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    level: { control: { type: "select" }, options: [1, 2, 3, 4, 5, 6] },
  },
};

export default meta;
type Story = StoryObj<typeof Heading>;

export const Level1: Story = {
  args: { level: 1, children: "Project Overview" },
};

export const Level2: Story = {
  args: { level: 2, children: "Contract Details" },
};

export const Level3: Story = {
  args: { level: 3, children: "Schedule of Values" },
};

export const Level4: Story = {
  args: { level: 4, children: "Line Item Summary" },
};

export const Level5: Story = {
  args: { level: 5, children: "Notes" },
};

export const Level6: Story = {
  args: { level: 6, children: "Subsection Label" },
};

export const AllLevels: Story = {
  name: "All Levels",
  render: () => (
    <div className="space-y-4">
      <Heading level={1}>H1 — Page Title</Heading>
      <Heading level={2}>H2 — Section Header</Heading>
      <Heading level={3}>H3 — Subsection</Heading>
      <Heading level={4}>H4 — Card Title</Heading>
      <Heading level={5}>H5 — Label Group</Heading>
      <Heading level={6}>H6 — Minor Label</Heading>
    </div>
  ),
};
