import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Search, DollarSign, Percent } from "lucide-react";
import { Input } from "./input";
import { InputGroup, InputGroupAddon } from "./input-group";

const meta: Meta = {
  title: "Inputs/InputGroup",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const WithLeadingIcon = {
  render: () => (
    <InputGroup className="w-72">
      <InputGroupAddon align="inline-start">
        <Search className="h-4 w-4" />
      </InputGroupAddon>
      <Input placeholder="Search subcontracts…" />
    </InputGroup>
  ),
};

export const WithLeadingText = {
  render: () => (
    <InputGroup className="w-48">
      <InputGroupAddon align="inline-start">
        <DollarSign className="h-4 w-4" />
      </InputGroupAddon>
      <Input placeholder="" className="text-right" />
    </InputGroup>
  ),
};

export const WithTrailingText = {
  render: () => (
    <InputGroup className="w-40">
      <Input placeholder="" className="text-right" />
      <InputGroupAddon align="inline-end">
        <Percent className="h-4 w-4" />
      </InputGroupAddon>
    </InputGroup>
  ),
};
