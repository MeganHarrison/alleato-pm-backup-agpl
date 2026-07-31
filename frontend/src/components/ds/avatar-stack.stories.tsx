import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AvatarStack } from "./avatar-stack";

const meta: Meta<typeof AvatarStack> = {
  title: "Data Display/AvatarStack",
  component: AvatarStack,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof AvatarStack>;

export const Default: Story = {
  args: {
    avatars: ["SC", "MH", "RK"],
  },
};

export const WithOverflow: Story = {
  args: {
    avatars: ["SC", "MH", "RK", "AL", "BT"],
    max: 3,
  },
};

export const Large: Story = {
  args: {
    avatars: ["SC", "MH", "RK"],
    size: "md",
  },
};

export const SingleAvatar: Story = {
  args: {
    avatars: ["JD"],
  },
};

export const ManyUsers: Story = {
  args: {
    avatars: ["SC", "MH", "RK", "AL", "BT", "CW", "DE"],
    max: 5,
    size: "md",
  },
};
