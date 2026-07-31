import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Stepper, type Step } from "./stepper";

const meta: Meta = {
  title: "Navigation/Stepper",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const contractSteps: Step[] = [
  { id: "vendor", label: "Vendor & Type", description: "Select vendor and contract type" },
  { id: "scope", label: "Scope & Value", description: "Define scope and contract value" },
  { id: "schedule", label: "Schedule", description: "Set start and completion dates" },
  { id: "terms", label: "Terms & Conditions", description: "Review billing and retainage terms" },
  { id: "review", label: "Review & Execute", description: "Final review before execution" },
];

function HorizontalDemo() {
  const [current, setCurrent] = React.useState(1);
  return (
    <div className="space-y-8 max-w-2xl">
      <Stepper steps={contractSteps} currentStep={current} />
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Step {current + 1}: {contractSteps[current]?.label}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
          Previous
        </Button>
        <Button onClick={() => setCurrent((c) => Math.min(contractSteps.length - 1, c + 1))} disabled={current === contractSteps.length - 1}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function VerticalDemo() {
  const [current, setCurrent] = React.useState(2);
  return (
    <div className="flex gap-12 max-w-2xl">
      <div className="w-56">
        <Stepper steps={contractSteps} currentStep={current} orientation="vertical" />
      </div>
      <div className="flex-1 space-y-4">
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {contractSteps[current]?.label}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
            Back
          </Button>
          <Button size="sm" onClick={() => setCurrent((c) => Math.min(contractSteps.length - 1, c + 1))} disabled={current === contractSteps.length - 1}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Horizontal = { render: () => <HorizontalDemo /> };
export const Vertical = { render: () => <VerticalDemo /> };

export const Complete = {
  render: () => (
    <div className="max-w-2xl">
      <Stepper steps={contractSteps} currentStep={contractSteps.length} />
    </div>
  ),
};

export const FirstStep = {
  render: () => (
    <div className="max-w-2xl">
      <Stepper steps={contractSteps} currentStep={0} />
    </div>
  ),
};
