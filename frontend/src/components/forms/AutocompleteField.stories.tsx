import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AutocompleteField } from "./AutocompleteField";

const meta: Meta<typeof AutocompleteField> = {
  title: "Inputs/AutocompleteField",
  component: AutocompleteField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof AutocompleteField>;

const vendorOptions = [
  { value: "pac-mech", label: "Pacific Mechanical Inc.", description: "License #C-20" },
  { value: "wce", label: "West Coast Electrical", description: "License #C-10" },
  { value: "atlas", label: "Atlas Concrete Group", description: "License #C-8" },
  { value: "premier", label: "Premier Glass & Glazing", description: "License #C-17" },
  { value: "bay-steel", label: "Bay Area Steel Erectors", description: "License #C-51" },
  { value: "sunbelt", label: "Sunbelt Plumbing Co.", description: "License #C-36" },
];

export const Default: Story = {
  args: {
    label: "Vendor",
    options: vendorOptions,
    placeholder: "Search vendors...",
  },
};

export const Required: Story = {
  args: {
    label: "Primary Subcontractor",
    options: vendorOptions,
    required: true,
    placeholder: "Select a vendor",
  },
};

export const WithValue: Story = {
  args: {
    label: "Vendor",
    options: vendorOptions,
    value: "pac-mech",
  },
};

export const Clearable: Story = {
  args: {
    label: "Assigned PM",
    options: [
      { value: "sc", label: "Sarah Chen" },
      { value: "mh", label: "Marcus Harris" },
      { value: "rk", label: "Rachel Kim" },
    ],
    value: "sc",
    clearable: true,
  },
};

export const WithHint: Story = {
  args: {
    label: "Architect of Record",
    options: vendorOptions,
    hint: "Select the licensed architect responsible for the project drawings.",
    clearable: true,
  },
};

export const WithError: Story = {
  args: {
    label: "Vendor",
    options: vendorOptions,
    error: "A vendor must be selected before the contract can be executed.",
  },
};
