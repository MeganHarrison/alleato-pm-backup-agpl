import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import { StatusBadge, StatusDot } from "./status-badge";

const meta: Meta<typeof StatusBadge> = {
  component: StatusBadge,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const RendersApproved: Story = {
  args: { status: "approved" },
  play: async ({ canvas }) => {
    const badge = canvas.getByText("approved");
    await expect(badge).toBeInTheDocument();
  },
};

export const RendersRejected: Story = {
  args: { status: "rejected" },
  play: async ({ canvas }) => {
    const badge = canvas.getByText("rejected");
    await expect(badge).toBeInTheDocument();
  },
};

/**
 * CssCheck — asserts that the success variant applies a non-empty background.
 * Exactly one CssCheck story across all story files.
 */
export const CssCheck: Story = {
  args: { status: "approved" },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(() => {
      const badge = canvas.getByText("approved");
      expect(badge).toBeInTheDocument();
      const style = getComputedStyle(badge);
      // bg-green-50 computes to a non-transparent background
      expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(style.backgroundColor).not.toBe("transparent");
    });
  },
};

export const StatusDotRendered: StoryObj<typeof StatusDot> = {
  render: () => <StatusDot status="pending" />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("pending")).toBeInTheDocument();
  },
};
