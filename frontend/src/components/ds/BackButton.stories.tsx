import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BackButton } from "./BackButton";

const meta: Meta<typeof BackButton> = {
  title: "Navigation/BackButton",
  component: BackButton,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof BackButton>;

export const Default: Story = {
  args: {
    onClick: () => {},
  },
};

export const CustomLabel: Story = {
  args: {
    label: "Back to Contracts",
    onClick: () => {},
  },
};

export const WithHref: Story = {
  args: {
    href: "/projects",
    label: "Back to Projects",
  },
};
