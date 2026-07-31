import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { toast, Toaster } from "sonner";
import { Button } from "./button";

const meta: Meta = {
  title: "Feedback/Toast",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <>
        <Toaster position="bottom-right" theme="light" />
        <Story />
      </>
    ),
  ],
};

export default meta;

export const Default = {
  render: () => (
    <Button onClick={() => toast("Change order saved.")}>
      Show Toast
    </Button>
  ),
};

export const Success = {
  render: () => (
    <Button onClick={() => toast.success("CO-042 approved and executed.")}>
      Success Toast
    </Button>
  ),
};

export const Error = {
  render: () => (
    <Button variant="destructive" onClick={() => toast.error("Failed to submit invoice. Please try again.")}>
      Error Toast
    </Button>
  ),
};

export const Warning = {
  render: () => (
    <Button variant="outline" onClick={() => toast.warning("Budget threshold exceeded.")}>
      Warning Toast
    </Button>
  ),
};

export const AllTypes = {
  name: "All types",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => toast("Default message")}>Default</Button>
      <Button size="sm" onClick={() => toast.success("Success!")}>Success</Button>
      <Button size="sm" onClick={() => toast.error("Error!")}>Error</Button>
      <Button size="sm" onClick={() => toast.warning("Warning!")}>Warning</Button>
      <Button size="sm" onClick={() => toast.info("Info message")}>Info</Button>
    </div>
  ),
};
