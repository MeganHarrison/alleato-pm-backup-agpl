import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Info, HelpCircle } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const meta: Meta = {
  title: "Overlays/Tooltip",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>
        Click to open the contract detail view
      </TooltipContent>
    </Tooltip>
  ),
};

export const OnIcon = {
  render: () => (
    <div className="flex items-center gap-1.5 text-sm">
      <span>Retainage</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent>
          The percentage withheld from each payment until project completion.
        </TooltipContent>
      </Tooltip>
    </div>
  ),
};

export const Positions = {
  render: () => (
    <div className="flex items-center gap-6">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Tooltip key={side}>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm">{side}</Button>
          </TooltipTrigger>
          <TooltipContent side={side}>
            Tooltip on the {side}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
};
