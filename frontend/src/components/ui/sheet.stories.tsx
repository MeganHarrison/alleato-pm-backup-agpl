import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta: Meta = {
  title: "Overlays/Sheet",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open Sheet</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit Subcontract</SheetTitle>
          <SheetDescription>
            Update the subcontract details. Changes will be saved when you click Save.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label>Contract Value</Label>
            <Input defaultValue="$485,000" />
          </div>
          <div className="space-y-1.5">
            <Label>Retainage %</Label>
            <Input defaultValue="10" />
          </div>
        </div>
        <SheetFooter>
          <Button>Save Changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const FromLeft = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open from Left</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Project Navigation</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-2">
          {["Overview", "Budget", "Commitments", "Invoicing", "RFIs", "Submittals"].map((item) => (
            <div key={item} className="px-2 py-2 rounded-md text-sm hover:bg-muted cursor-pointer">{item}</div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  ),
};
