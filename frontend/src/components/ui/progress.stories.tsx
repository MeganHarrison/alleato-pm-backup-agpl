import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Progress } from "./progress";

const meta: Meta = {
  title: "Feedback/Progress",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => <Progress value={60} className="w-80" />,
};

export const Values = {
  name: "Various values",
  render: () => (
    <div className="space-y-4 w-80">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Budget Used</span><span>25%</span>
        </div>
        <Progress value={25} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Invoiced</span><span>58%</span>
        </div>
        <Progress value={58} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Retainage Released</span><span>90%</span>
        </div>
        <Progress value={90} />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Complete</span><span>100%</span>
        </div>
        <Progress value={100} />
      </div>
    </div>
  ),
};

export const Indeterminate = {
  render: () => <Progress className="w-80" />,
};
