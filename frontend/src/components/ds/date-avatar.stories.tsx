import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DateAvatar } from "./date-avatar";

const meta: Meta<typeof DateAvatar> = {
  title: "Data Display/DateAvatar",
  component: DateAvatar,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DateAvatar>;

export const Default: Story = {
  args: {
    date: "2024-06-15",
  },
};

export const Small: Story = {
  args: {
    date: "2024-06-15",
    size: "sm",
  },
};

export const Medium: Story = {
  args: {
    date: "2024-12-31",
    size: "md",
  },
};

export const AllMonths: Story = {
  name: "All Months",
  render: () => (
    <div className="flex flex-wrap gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <DateAvatar key={i} date={new Date(2024, i, 1)} />
      ))}
    </div>
  ),
};

export const InContext: Story = {
  name: "In a list row",
  render: () => (
    <div className="space-y-3 w-80">
      {[
        { date: "2024-03-15", label: "Concrete Pour — Level 2" },
        { date: "2024-04-02", label: "MEP Rough-In Inspection" },
        { date: "2024-05-20", label: "Steel Erection Complete" },
      ].map((item) => (
        <div key={item.date} className="flex items-center gap-3">
          <DateAvatar date={item.date} />
          <span className="text-sm font-medium">{item.label}</span>
        </div>
      ))}
    </div>
  ),
};
