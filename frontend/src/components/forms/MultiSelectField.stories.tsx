import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MultiSelectField } from "./MultiSelectField";

const meta: Meta<typeof MultiSelectField> = {
  title: "Inputs/MultiSelectField",
  component: MultiSelectField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof MultiSelectField>;

const costCodeOptions = [
  { value: "01-000", label: "01-000 General Requirements" },
  { value: "03-000", label: "03-000 Concrete" },
  { value: "05-000", label: "05-000 Metals" },
  { value: "07-000", label: "07-000 Thermal & Moisture Protection" },
  { value: "08-000", label: "08-000 Openings" },
  { value: "09-000", label: "09-000 Finishes" },
  { value: "15-000", label: "15-000 Mechanical" },
  { value: "16-000", label: "16-000 Electrical" },
];

export const Default: Story = {
  args: {
    label: "Cost Codes",
    options: costCodeOptions,
    placeholder: "Select cost codes",
  },
};

export const WithValue: Story = {
  args: {
    label: "Applicable Divisions",
    options: costCodeOptions,
    value: ["03-000", "05-000", "15-000"],
  },
};

export const Required: Story = {
  args: {
    label: "Trade Scope",
    options: costCodeOptions,
    required: true,
    placeholder: "Select all applicable trades",
  },
};

export const WithHint: Story = {
  args: {
    label: "Notify Team Members",
    options: [
      { value: "pm", label: "Project Manager" },
      { value: "super", label: "Superintendent" },
      { value: "owner", label: "Owner Representative" },
      { value: "architect", label: "Architect" },
    ],
    hint: "Selected contacts will receive an email when this is submitted.",
  },
};

export const WithError: Story = {
  args: {
    label: "Cost Codes",
    options: costCodeOptions,
    error: "At least one cost code must be selected.",
  },
};
