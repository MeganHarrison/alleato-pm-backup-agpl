import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Spinner } from "./spinner";

const meta: Meta = {
  title: "Feedback/Spinner",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => <Spinner />,
};

export const Sizes = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="size-3" />
      <Spinner className="size-4" />
      <Spinner className="size-5" />
      <Spinner className="size-6" />
      <Spinner className="size-8" />
    </div>
  ),
};

export const WithLabel = {
  render: () => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner />
      Loading subcontracts…
    </div>
  ),
};

export const InButton = {
  render: () => (
    <Button disabled className="gap-2 opacity-70">
      <Spinner className="size-4" />
      Saving…
    </Button>
  ),
};
