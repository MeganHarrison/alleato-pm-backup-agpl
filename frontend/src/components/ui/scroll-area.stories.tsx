import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";

const meta: Meta = {
  title: "Utility/ScrollArea",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

const tags = [
  "Budget Variance", "Change Order", "RFI", "Submittal", "Daily Log",
  "Meeting Notes", "Prime Contract", "Subcontract", "Purchase Order",
  "Invoice", "Pay Application", "Lien Waiver", "Punch List", "Drawing",
  "Specification", "Transmittal", "Photo Documentation", "Schedule Update",
];

export const Default = {
  render: () => (
    <ScrollArea className="h-64 w-64 rounded-md border p-3">
      <div className="space-y-2">
        {tags.map((tag) => (
          <div key={tag} className="text-sm text-foreground">{tag}</div>
        ))}
      </div>
    </ScrollArea>
  ),
};

export const WithSeparators = {
  render: () => (
    <ScrollArea className="h-72 w-80 rounded-md border">
      <div className="p-4">
        <h4 className="mb-3 text-sm font-medium">Projects</h4>
        {[
          "Vermillion Rise Warehouse",
          "Oakwood Office Complex",
          "Harbor View Residences",
          "Midtown Mixed-Use Development",
          "Eastside Industrial Park",
          "Sunset Ridge Apartments",
          "Downtown Parking Structure",
          "Riverfront Retail Center",
        ].map((project, i) => (
          <React.Fragment key={project}>
            <div className="py-2 text-sm">{project}</div>
            {i < 7 && <Separator />}
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  ),
};
