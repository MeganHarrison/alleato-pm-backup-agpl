import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Search } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { ButtonGroup, ButtonGroupText } from "./button-group";

const meta: Meta = {
  title: "Actions/ButtonGroup",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Previous</Button>
      <Button variant="outline">Next</Button>
    </ButtonGroup>
  ),
};

export const WithInput = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>
        <Search className="h-4 w-4" />
      </ButtonGroupText>
      <Input placeholder="Search contracts…" className="rounded-l-none" />
    </ButtonGroup>
  ),
};

export const ThreeButtons = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm">Day</Button>
      <Button variant="outline" size="sm">Week</Button>
      <Button variant="outline" size="sm">Month</Button>
    </ButtonGroup>
  ),
};

export const Vertical = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Overview</Button>
      <Button variant="outline">Budget</Button>
      <Button variant="outline">Commitments</Button>
    </ButtonGroup>
  ),
};
