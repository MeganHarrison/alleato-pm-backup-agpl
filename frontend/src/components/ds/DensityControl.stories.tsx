import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { DensityControl } from "./density-control";

const meta: Meta = {
  title: "Actions/DensityControl",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [density, setDensity] = React.useState<"compact" | "default" | "comfortable">("default");
  return (
    <DensityControl
      value={density}
      onChange={setDensity}
      options={[
        { value: "compact", label: "Compact" },
        { value: "default", label: "Default" },
        { value: "comfortable", label: "Comfortable" },
      ]}
      className="w-56"
    />
  );
}

function TwoOptionsDemo() {
  const [view, setView] = React.useState<"list" | "grid">("list");
  return (
    <DensityControl
      value={view}
      onChange={setView}
      options={[
        { value: "list", label: "List" },
        { value: "grid", label: "Grid" },
      ]}
      className="w-32"
    />
  );
}

export const Default = { render: () => <DefaultDemo /> };
export const TwoOptions = { render: () => <TwoOptionsDemo /> };
