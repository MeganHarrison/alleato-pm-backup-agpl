import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { CalendarIcon, Settings } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const meta: Meta = {
  title: "Overlays/Popover",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open Popover</Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-sm text-muted-foreground">
          This is a popover. It can contain any content.
        </p>
      </PopoverContent>
    </Popover>
  ),
};

export const WithForm = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4" />
          Filter Options
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Filter by Vendor</h4>
          <div className="space-y-1.5">
            <Label>Vendor Name</Label>
            <Input placeholder="Search vendors..." />
          </div>
          <div className="space-y-1.5">
            <Label>Min Value</Label>
            <Input placeholder="$0" />
          </div>
          <Button size="sm" className="w-full">Apply Filters</Button>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const DatePicker = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-52 justify-start text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          Pick a date
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 text-sm text-muted-foreground">
          Calendar would render here
        </div>
      </PopoverContent>
    </Popover>
  ),
};
