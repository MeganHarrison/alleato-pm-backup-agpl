import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { RadioGroup, RadioGroupItem } from "./radio-group";

const meta: Meta = {
  title: "Inputs/RadioGroup",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <RadioGroup defaultValue="lump-sum">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="lump-sum" id="lump-sum" />
        <Label htmlFor="lump-sum">Lump Sum</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="cost-plus" id="cost-plus" />
        <Label htmlFor="cost-plus">Cost Plus</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="gmp" id="gmp" />
        <Label htmlFor="gmp">Guaranteed Maximum Price (GMP)</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="unit-price" id="unit-price" />
        <Label htmlFor="unit-price">Unit Price</Label>
      </div>
    </RadioGroup>
  ),
};

export const Horizontal = {
  render: () => (
    <RadioGroup defaultValue="pending" className="flex gap-6">
      {["pending", "approved", "rejected"].map((value) => (
        <div key={value} className="flex items-center gap-2">
          <RadioGroupItem value={value} id={value} />
          <Label htmlFor={value} className="capitalize">{value}</Label>
        </div>
      ))}
    </RadioGroup>
  ),
};
