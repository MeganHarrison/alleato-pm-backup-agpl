import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import type { DateRange } from "react-day-picker";
import { Calendar } from "./calendar";

const meta: Meta = {
  title: "Inputs/Calendar",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

function DefaultDemo() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-md border"
    />
  );
}

function RangePickerDemo() {
  const [range, setRange] = React.useState<DateRange | undefined>();
  return (
    <Calendar
      mode="range"
      selected={range}
      onSelect={setRange}
      className="rounded-md border"
      numberOfMonths={2}
    />
  );
}

export const Default = { render: () => <DefaultDemo /> };
export const RangePicker = { render: () => <RangePickerDemo /> };

export const WithDisabledDates = {
  render: () => {
    const today = new Date();
    return (
      <Calendar
        mode="single"
        className="rounded-md border"
        disabled={(date) => date < today}
      />
    );
  },
};
