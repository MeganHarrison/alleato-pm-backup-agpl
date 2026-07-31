import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import * as React from "react";
import { MoneyField } from "./MoneyField";

const meta: Meta<typeof MoneyField> = {
  title: "Inputs/MoneyField",
  component: MoneyField,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof MoneyField>;

function Controlled(props: React.ComponentProps<typeof MoneyField>) {
  const [value, setValue] = React.useState<number | undefined>(props.value);
  return <MoneyField {...props} value={value} onChange={setValue} />;
}

export const Default: Story = {
  render: () => <Controlled label="Contract Amount" />,
};

export const WithValue: Story = {
  render: () => <Controlled label="Contract Amount" value={125000} />,
};

export const WithHint: Story = {
  render: () => (
    <Controlled
      label="Budget Amount"
      value={50000}
      hint="This amount will be applied to the approved budget."
    />
  ),
};

export const WithError: Story = {
  render: () => (
    <Controlled
      label="Contract Amount"
      value={0}
      error="Amount must be greater than zero."
    />
  ),
};

export const AllowNegative: Story = {
  render: () => (
    <Controlled label="Variance" value={-2500.5} allowNegative />
  ),
};

export const Required: Story = {
  render: () => <Controlled label="Original Budget" required />,
};

export const Disabled: Story = {
  render: () => (
    <Controlled label="Approved Amount" value={99999.99} disabled />
  ),
};

export const InlineMode: Story = {
  render: () => (
    <div className="w-48">
      <Controlled label="Unit Cost" value={1200} inline />
    </div>
  ),
};
