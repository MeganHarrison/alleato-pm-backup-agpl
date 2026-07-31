import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "./label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const meta: Meta = {
  title: "Inputs/Select",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Select>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select contract type" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="lump-sum">Lump Sum</SelectItem>
        <SelectItem value="cost-plus">Cost Plus</SelectItem>
        <SelectItem value="gmp">GMP (Guaranteed Maximum Price)</SelectItem>
        <SelectItem value="unit-price">Unit Price</SelectItem>
        <SelectItem value="time-materials">Time & Materials</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const WithLabel = {
  render: () => (
    <div className="space-y-1.5 w-64">
      <Label>Contract Status</Label>
      <Select defaultValue="active">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="void">Void</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Small = {
  render: () => (
    <Select>
      <SelectTrigger size="sm" className="w-48">
        <SelectValue placeholder="Filter by status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="closed">Closed</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Not available" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Option A</SelectItem>
      </SelectContent>
    </Select>
  ),
};
