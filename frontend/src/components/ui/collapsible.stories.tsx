import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { ChevronDown } from "lucide-react";
import { Button } from "./button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";

const meta: Meta = {
  title: "Utility/Collapsible",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-80 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Change Order History</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </div>
      <div className="rounded-md border px-3 py-2 text-sm">
        CO-042 — $22,500 — Approved
      </div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-3 py-2 text-sm">
          CO-041 — $8,000 — Approved
        </div>
        <div className="rounded-md border px-3 py-2 text-sm">
          CO-040 — $15,200 — Approved
        </div>
        <div className="rounded-md border px-3 py-2 text-sm">
          CO-039 — $4,500 — Voided
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const Default = { render: () => <DefaultDemo /> };
