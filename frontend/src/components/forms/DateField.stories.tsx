import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DateField } from "./DateField";

const meta: Meta<typeof DateField> = {
  title: "Inputs/DateField",
  component: DateField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DateField>;

export const Default: Story = { args: { label: "Start Date" } };
export const Required: Story = { args: { label: "Completion Date", required: true } };
export const WithValue: Story = { args: { label: "Contract Date", value: new Date("2024-06-15") } };
export const WithHint: Story = { args: { label: "Substantial Completion", hint: "The date by which all major work must be complete." } };
export const WithError: Story = { args: { label: "Start Date", error: "Start date cannot be after the completion date." } };

function InteractiveDemo() {
  const [date, setDate] = React.useState<Date | undefined>();
  return (
    <div className="space-y-2 w-64">
      <DateField
        label="Project Start Date"
        value={date}
        onChange={setDate}
        required
      />
      {date && (
        <p className="text-xs text-muted-foreground">
          Selected: {date.toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export const Interactive: Story = { render: () => <InteractiveDemo /> };
