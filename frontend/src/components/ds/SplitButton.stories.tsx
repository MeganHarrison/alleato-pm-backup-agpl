import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SplitButton } from "./SplitButton";

const meta: Meta<typeof SplitButton> = {
  title: "Actions/SplitButton",
  component: SplitButton,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof SplitButton>;

const defaultActions = [
  { label: "Save & Close", onClick: () => {} },
  { label: "Save as Draft", onClick: () => {} },
];

export const Default: Story = {
  args: {
    label: "Save",
    onClick: () => {},
    actions: defaultActions,
  },
};

export const Outline: Story = {
  args: {
    label: "Export",
    onClick: () => {},
    variant: "outline",
    actions: [
      { label: "Export as PDF", onClick: () => {} },
      { label: "Export as CSV", onClick: () => {} },
      { label: "Export as Excel", onClick: () => {} },
    ],
  },
};

export const Soft: Story = {
  args: {
    label: "Submit for Review",
    onClick: () => {},
    variant: "soft",
    actions: [
      { label: "Submit & Notify Owner", onClick: () => {} },
      { label: "Submit as Draft", onClick: () => {} },
    ],
  },
};

export const Small: Story = {
  args: {
    label: "Approve",
    onClick: () => {},
    size: "sm",
    actions: [
      { label: "Approve & Execute", onClick: () => {} },
      { label: "Approve with Comments", onClick: () => {} },
      { separator: true, label: "Reject", onClick: () => {}, destructive: true },
    ],
  },
};

export const Loading: Story = {
  args: {
    label: "Submitting…",
    onClick: () => {},
    isLoading: true,
    actions: defaultActions,
  },
};

export const Disabled: Story = {
  args: {
    label: "Save",
    onClick: () => {},
    disabled: true,
    actions: defaultActions,
  },
};
