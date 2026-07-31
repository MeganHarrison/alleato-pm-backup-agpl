import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { InfoAlert } from "./InfoAlert";

const meta: Meta<typeof InfoAlert> = {
  component: InfoAlert,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof InfoAlert>;

export const InfoVariant: Story = {
  args: { variant: "info", children: "This is an info message." },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This is an info message.")).toBeInTheDocument();
    await expect(canvas.getByRole("note")).toBeInTheDocument();
  },
};

export const WarningVariant: Story = {
  args: { variant: "warning", children: "This is a warning message." },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("This is a warning message.")).toBeInTheDocument();
  },
};

export const SuccessVariant: Story = {
  args: { variant: "success", children: "Operation completed successfully." },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Operation completed successfully.")).toBeInTheDocument();
  },
};

export const ErrorVariant: Story = {
  args: { variant: "error", children: "Something went wrong." },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Something went wrong.")).toBeInTheDocument();
  },
};

export const WithAlertRole: Story = {
  args: { variant: "error", role: "alert", children: "Critical error detected." },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("alert")).toBeInTheDocument();
  },
};
