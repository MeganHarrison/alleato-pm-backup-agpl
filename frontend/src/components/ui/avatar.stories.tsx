import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";

const meta: Meta = {
  title: "Data Display/Avatar",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const WithFallback = {
  render: () => (
    <Avatar>
      <AvatarFallback>SC</AvatarFallback>
    </Avatar>
  ),
};

export const WithImage = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="User" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes = {
  render: () => (
    <div className="flex items-end gap-4">
      <Avatar size="sm">
        <AvatarFallback>SM</AvatarFallback>
      </Avatar>
      <Avatar size="default">
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar size="lg">
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const Group = {
  name: "Avatar group",
  render: () => (
    <div className="flex -space-x-2">
      {["SC", "MH", "RK", "AL"].map((initials) => (
        <Avatar key={initials} className="ring-2 ring-background">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
