import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Switch } from "./switch";

const meta: Meta = {
  title: "Inputs/Switch",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <Switch />,
};

export const Checked = {
  render: () => <Switch defaultChecked />,
};

export const WithLabel = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="notify" defaultChecked />
      <Label htmlFor="notify">Email notifications</Label>
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <div className="flex items-center gap-2 opacity-50">
      <Switch id="disabled" disabled />
      <Label htmlFor="disabled">Feature locked</Label>
    </div>
  ),
};

export const List = {
  render: () => (
    <div className="space-y-4 w-72">
      {[
        { id: "emails", label: "Email notifications", checked: true },
        { id: "sms", label: "SMS alerts", checked: false },
        { id: "budget", label: "Budget threshold alerts", checked: true },
        { id: "rfi", label: "RFI due date reminders", checked: false },
      ].map((item) => (
        <div key={item.id} className="flex items-center justify-between">
          <Label htmlFor={item.id}>{item.label}</Label>
          <Switch id={item.id} defaultChecked={item.checked} />
        </div>
      ))}
    </div>
  ),
};
