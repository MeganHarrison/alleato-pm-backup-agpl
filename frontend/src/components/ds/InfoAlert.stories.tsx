import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { InfoAlert } from "./InfoAlert";

const meta: Meta<typeof InfoAlert> = {
  title: "Feedback/InfoAlert",
  component: InfoAlert,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof InfoAlert>;

export const Info: Story = {
  args: {
    variant: "info",
    children: "This contract is pending owner approval before work can begin.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "Budget is 87% consumed. Review cost-to-complete before approving new change orders.",
  },
};

export const Success: Story = {
  args: {
    variant: "success",
    children: "Change order CO-042 has been approved and executed.",
  },
};

export const Error: Story = {
  args: {
    variant: "error",
    children: "Failed to submit invoice. The billing period overlaps with an existing pay application.",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <div className="space-y-3">
      <InfoAlert variant="info">
        This subcontract requires a signed certificate of insurance before execution.
      </InfoAlert>
      <InfoAlert variant="warning">
        Retainage reduction requires owner approval. Submit a formal request first.
      </InfoAlert>
      <InfoAlert variant="success">
        All submittal items have been approved. The subcontract is ready to execute.
      </InfoAlert>
      <InfoAlert variant="error">
        Duplicate invoice detected. An invoice for this billing period already exists.
      </InfoAlert>
    </div>
  ),
};
