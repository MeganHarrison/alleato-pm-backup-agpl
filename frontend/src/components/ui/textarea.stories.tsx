import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta: Meta = {
  title: "Inputs/Textarea",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <Textarea placeholder="Add a note…" className="w-96" />,
};

export const WithLabel = {
  render: () => (
    <div className="space-y-1.5 w-96">
      <Label>Change Order Description</Label>
      <Textarea
        placeholder="Describe the scope change and reason for the modification…"
        rows={4}
      />
    </div>
  ),
};

export const WithValue = {
  render: () => (
    <div className="space-y-1.5 w-96">
      <Label>Notes</Label>
      <Textarea
        defaultValue="Owner requested expedited delivery on framing materials due to weather delays. Additional cost of $12,500 approved via email on 2024-03-15."
        rows={4}
      />
    </div>
  ),
};

export const Disabled = {
  render: () => (
    <Textarea
      disabled
      className="w-96"
      defaultValue="This field is read-only in the current status."
    />
  ),
};
