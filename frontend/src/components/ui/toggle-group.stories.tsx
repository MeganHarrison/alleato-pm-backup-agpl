import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { AlignLeft, AlignCenter, AlignRight, List, Grid } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

const meta: Meta = {
  title: "Actions/ToggleGroup",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <ToggleGroup type="single" defaultValue="list">
      <ToggleGroupItem value="list" aria-label="List view">
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Grid view">
        <Grid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Outline = {
  render: () => (
    <ToggleGroup type="single" variant="outline" defaultValue="center">
      <ToggleGroupItem value="left" aria-label="Align left">
        <AlignLeft className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center">
        <AlignCenter className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right">
        <AlignRight className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

export const Multiple = {
  render: () => (
    <ToggleGroup type="multiple">
      <ToggleGroupItem value="budget">Budget</ToggleGroupItem>
      <ToggleGroupItem value="commitments">Commitments</ToggleGroupItem>
      <ToggleGroupItem value="invoices">Invoices</ToggleGroupItem>
    </ToggleGroup>
  ),
};
