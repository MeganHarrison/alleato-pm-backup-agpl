import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { Toggle } from "./toggle";

const meta: Meta = {
  title: "Actions/Toggle",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "select", options: ["default", "outline"] },
    size: { control: "select", options: ["sm", "default", "lg"] },
  },
};

export default meta;

export const Default = {
  render: () => <Toggle aria-label="Bold">B</Toggle>,
};

export const WithIcon = {
  render: () => (
    <Toggle aria-label="Bold">
      <Bold className="h-4 w-4" />
    </Toggle>
  ),
};

export const Outline = {
  render: () => (
    <Toggle variant="outline" aria-label="Italic">
      <Italic className="h-4 w-4" />
    </Toggle>
  ),
};

export const Toolbar = {
  render: () => (
    <div className="flex items-center gap-1">
      <Toggle size="sm" aria-label="Bold"><Bold className="h-3.5 w-3.5" /></Toggle>
      <Toggle size="sm" aria-label="Italic"><Italic className="h-3.5 w-3.5" /></Toggle>
      <Toggle size="sm" aria-label="Underline"><Underline className="h-3.5 w-3.5" /></Toggle>
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <Toggle disabled aria-label="Disabled">
      <AlignCenter className="h-4 w-4" />
    </Toggle>
  ),
};
