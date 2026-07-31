import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "@/components/ui/label";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Inputs/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "inline"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "Enter text...",
    type: "text",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="space-y-1.5 max-w-sm">
      <Label htmlFor="project-name">Project Name</Label>
      <Input id="project-name" placeholder="e.g. Vermillion Rise Warehouse" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true,
    value: "Cannot be changed",
  },
};

export const Error: Story = {
  render: () => (
    <div className="space-y-1.5 max-w-sm">
      <Label htmlFor="error-field">Contract Value</Label>
      <Input
        id="error-field"
        placeholder="Enter amount"
        aria-invalid="true"
        className="border-destructive focus-visible:border-destructive"
        defaultValue="not-a-number"
      />
      <p className="text-xs text-destructive">Please enter a valid number.</p>
    </div>
  ),
};

export const NumberInput: Story = {
  args: {
    type: "number",
    placeholder: "",
  },
};

export const Inline: Story = {
  args: {
    variant: "inline",
    placeholder: "Inline input (no border)",
  },
};

export const AllTypes: Story = {
  name: "All Types",
  render: () => (
    <div className="space-y-3 max-w-sm">
      <div className="space-y-1">
        <Label>Text</Label>
        <Input type="text" placeholder="Text input" />
      </div>
      <div className="space-y-1">
        <Label>Email</Label>
        <Input type="email" placeholder="name@example.com" />
      </div>
      <div className="space-y-1">
        <Label>Password</Label>
        <Input type="password" placeholder="••••••••" />
      </div>
      <div className="space-y-1">
        <Label>Number</Label>
        <Input type="number" placeholder="" />
      </div>
      <div className="space-y-1">
        <Label>Disabled</Label>
        <Input type="text" disabled value="Read only" />
      </div>
    </div>
  ),
};
