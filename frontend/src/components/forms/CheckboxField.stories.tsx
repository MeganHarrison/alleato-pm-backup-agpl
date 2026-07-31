import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CheckboxField } from "./CheckboxField";

const meta: Meta<typeof CheckboxField> = {
  title: "Inputs/CheckboxField",
  component: CheckboxField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof CheckboxField>;

export const Default: Story = {
  args: {
    label: "Include retainage in this billing period",
  },
};

export const Checked: Story = {
  args: {
    label: "Apply stored materials",
    checked: true,
  },
};

export const WithHint: Story = {
  args: {
    label: "Override billing period",
    hint: "Allow submission outside the standard billing window.",
  },
};

export const WithError: Story = {
  args: {
    label: "I confirm this invoice is accurate",
    error: "You must confirm accuracy before submitting.",
  },
};

export const Disabled: Story = {
  args: {
    label: "Auto-calculate forecast",
    checked: true,
    disabled: true,
    hint: "Disabled when the contract is in executed status.",
  },
};

function GroupDemo() {
  const [values, setValues] = React.useState({
    retainage: true,
    stored: false,
    override: false,
    notify: true,
  });
  const toggle = (key: keyof typeof values) =>
    setValues((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className="space-y-3 w-72">
      <CheckboxField label="Include retainage" checked={values.retainage} onCheckedChange={() => toggle("retainage")} />
      <CheckboxField label="Apply stored materials" checked={values.stored} onCheckedChange={() => toggle("stored")} />
      <CheckboxField label="Override billing period" checked={values.override} onCheckedChange={() => toggle("override")} />
      <CheckboxField label="Notify owner on submit" checked={values.notify} onCheckedChange={() => toggle("notify")} />
    </div>
  );
}

export const Group: Story = { render: () => <GroupDemo /> };
