import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorState } from "./error-state";

const meta: Meta<typeof ErrorState> = {
  title: "Feedback/ErrorState",
  component: ErrorState,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: {},
};

export const WithRetry: Story = {
  args: {
    onRetry: () => {},
  },
};

export const CustomMessage: Story = {
  args: {
    title: "Failed to load budget",
    description: "The budget data could not be retrieved. Check your connection and try again.",
    onRetry: () => {},
  },
};

export const WithError: Story = {
  args: {
    error: new Error("404: Budget not found for project ID 67"),
    onRetry: () => {},
  },
};

export const StringError: Story = {
  args: {
    error: "Permission denied. You don't have access to this resource.",
  },
};
