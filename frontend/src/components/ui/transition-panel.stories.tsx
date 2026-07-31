import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { TransitionPanel } from "./transition-panel";

const meta: Meta = {
  title: "Utility/TransitionPanel",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const panels = [
  {
    title: "Contract Overview",
    content: "Lump sum contract for general construction of Vermillion Rise Warehouse. Owner: Vermillion Rise LLC.",
  },
  {
    title: "Schedule of Values",
    content: "14 line items totaling $2,450,000. 58% complete as of the most recent pay application.",
  },
  {
    title: "Change Orders",
    content: "3 approved change orders adding $84,500 to the original contract value.",
  },
];

function DefaultDemo() {
  const [active, setActive] = React.useState(0);
  return (
    <div className="space-y-4 w-96">
      <div className="flex gap-2">
        {panels.map((panel, i) => (
          <Button
            key={i}
            size="sm"
            variant={active === i ? "default" : "outline"}
            onClick={() => setActive(i)}
          >
            {i + 1}
          </Button>
        ))}
      </div>
      <TransitionPanel
        activeIndex={active}
        variants={{
          enter: { opacity: 0, x: 20 },
          center: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: -20 },
        }}
        transition={{ duration: 0.2 }}
      >
        {panels.map((panel, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold">{panel.title}</h3>
            <p className="text-sm text-muted-foreground">{panel.content}</p>
          </div>
        ))}
      </TransitionPanel>
    </div>
  );
}

export const Default = { render: () => <DefaultDemo /> };
