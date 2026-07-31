import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Slider } from "./slider";

const meta: Meta = {
  title: "Inputs/Slider",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <Slider defaultValue={[50]} max={100} step={1} className="w-72" />,
};

function WithLabelsDemo() {
  const [value, setValue] = React.useState([65]);
  return (
    <div className="space-y-3 w-72">
      <div className="flex justify-between text-sm">
        <span>Retainage</span>
        <span className="font-medium">{value[0]}%</span>
      </div>
      <Slider value={value} onValueChange={setValue} max={100} step={1} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export const WithLabels = { render: () => <WithLabelsDemo /> };

export const Disabled = {
  render: () => <Slider defaultValue={[40]} disabled className="w-72" />,
};
