import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Slideover,
  SlideoverContent,
  SlideoverDescription,
  SlideoverFooter,
  SlideoverHeader,
  SlideoverTitle,
  SlideoverTrigger,
} from "./unified-slideover";

const meta: Meta = {
  title: "Overlays/Slideover",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Slideover>
      <SlideoverTrigger asChild>
        <Button variant="outline">Open Slideover</Button>
      </SlideoverTrigger>
      <SlideoverContent>
        <SlideoverHeader>
          <SlideoverTitle>Subcontract Details</SlideoverTitle>
          <SlideoverDescription>
            Review and edit the subcontract information.
          </SlideoverDescription>
        </SlideoverHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Input defaultValue="Pacific Mechanical Inc." />
          </div>
          <div className="space-y-1.5">
            <Label>Contract Value</Label>
            <Input defaultValue="$485,000" />
          </div>
          <div className="space-y-1.5">
            <Label>Retainage %</Label>
            <Input defaultValue="10" />
          </div>
        </div>
        <SlideoverFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </SlideoverFooter>
      </SlideoverContent>
    </Slideover>
  ),
};

export const Sizes = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Slideover key={size}>
          <SlideoverTrigger asChild>
            <Button variant="outline" size="sm">{size}</Button>
          </SlideoverTrigger>
          <SlideoverContent size={size}>
            <SlideoverHeader>
              <SlideoverTitle>Slideover: {size}</SlideoverTitle>
            </SlideoverHeader>
            <p className="text-sm text-muted-foreground py-4">
              This is a <strong>{size}</strong> slideover panel.
            </p>
          </SlideoverContent>
        </Slideover>
      ))}
    </div>
  ),
};

export const FromLeft = {
  render: () => (
    <Slideover>
      <SlideoverTrigger asChild>
        <Button variant="outline">From Left</Button>
      </SlideoverTrigger>
      <SlideoverContent side="left">
        <SlideoverHeader>
          <SlideoverTitle>Filters</SlideoverTitle>
        </SlideoverHeader>
        <div className="py-4 space-y-3">
          {["Status", "Vendor", "Date Range", "Cost Code"].map((f) => (
            <div key={f} className="space-y-1">
              <Label>{f}</Label>
              <Input placeholder={`Filter by ${f.toLowerCase()}`} />
            </div>
          ))}
        </div>
      </SlideoverContent>
    </Slideover>
  ),
};
