import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Stack } from "./stack";

const meta: Meta = {
  title: "Layout/Stack",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const Box = ({ label }: { label: string }) => (
  <div className="rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary">{label}</div>
);

export const Default = {
  render: () => (
    <Stack>
      <Box label="Item 1" />
      <Box label="Item 2" />
      <Box label="Item 3" />
    </Stack>
  ),
};

export const GapSizes = {
  name: "Gap sizes",
  render: () => (
    <div className="flex gap-12">
      {(["xs", "sm", "md", "lg", "xl"] as const).map((gap) => (
        <div key={gap}>
          <p className="mb-2 text-xs font-mono text-muted-foreground">{gap}</p>
          <Stack gap={gap}>
            <Box label="A" />
            <Box label="B" />
            <Box label="C" />
          </Stack>
        </div>
      ))}
    </div>
  ),
};

export const AlignCenter = {
  render: () => (
    <Stack gap="md" align="center">
      <Box label="Wide item that sets the width" />
      <Box label="Short" />
      <Box label="Medium length" />
    </Stack>
  ),
};
