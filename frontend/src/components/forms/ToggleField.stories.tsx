import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ToggleField } from "./ToggleField";

const meta: Meta<typeof ToggleField> = {
  title: "Inputs/ToggleField",
  component: ToggleField,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ToggleField>;

export const Default: Story = { args: { label: "Email notifications" } };
export const Enabled: Story = { args: { label: "Auto-approve change orders under $5,000", checked: true } };
export const WithHint: Story = { args: { label: "Retainage reduction", hint: "Automatically reduce retainage to 5% at 50% project completion.", checked: false } };
export const WithError: Story = { args: { label: "Allow owner access", error: "Owner access cannot be revoked while invoices are pending.", checked: true } };
export const Disabled: Story = { args: { label: "Lock budget after approval", checked: true, disabled: true, hint: "This setting is controlled by the project owner." } };

function ListDemo() {
  const [settings, setSettings] = React.useState({
    emails: true,
    budgetAlerts: true,
    rfiReminders: false,
    ownerAccess: true,
  });
  const toggle = (key: keyof typeof settings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div className="space-y-4 w-80 divide-y">
      <ToggleField label="Email notifications" checked={settings.emails} onCheckedChange={() => toggle("emails")} />
      <ToggleField className="pt-4" label="Budget threshold alerts" checked={settings.budgetAlerts} onCheckedChange={() => toggle("budgetAlerts")} hint="Alert when budget is 80% consumed." />
      <ToggleField className="pt-4" label="RFI due date reminders" checked={settings.rfiReminders} onCheckedChange={() => toggle("rfiReminders")} />
      <ToggleField className="pt-4" label="Owner portal access" checked={settings.ownerAccess} onCheckedChange={() => toggle("ownerAccess")} />
    </div>
  );
}

export const List: Story = { render: () => <ListDemo /> };
