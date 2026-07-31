import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import type { DateRange } from "react-day-picker";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "./date-range-picker";

const meta: Meta = {
  title: "Inputs/DateRangePicker",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [range, setRange] = React.useState<DateRange | undefined>();
  return <DateRangePicker value={range} onChange={setRange} className="w-72" />;
}

function WithValueDemo() {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from: new Date("2024-01-01"),
    to: new Date("2024-03-31"),
  });
  return <DateRangePicker value={range} onChange={setRange} className="w-72" />;
}

function WithLabelDemo() {
  const [range, setRange] = React.useState<DateRange | undefined>();
  return (
    <div className="space-y-1.5">
      <Label>Billing Period</Label>
      <DateRangePicker
        value={range}
        onChange={setRange}
        placeholder="Select billing period"
        className="w-72"
      />
    </div>
  );
}

export const Default = { render: () => <DefaultDemo /> };
export const WithValue = { render: () => <WithValueDemo /> };
export const WithLabel = { render: () => <WithLabelDemo /> };

export const Disabled = {
  render: () => (
    <DateRangePicker
      value={{ from: new Date("2024-01-01"), to: new Date("2024-06-30") }}
      disabled
      className="w-72"
    />
  ),
};
