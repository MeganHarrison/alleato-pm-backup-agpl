import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { KpiBlock, KpiRow } from "./kpi";

const meta: Meta<typeof KpiBlock> = {
  component: KpiBlock,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof KpiBlock>;

export const BasicMetric: Story = {
  args: { label: "Total Contract Value", value: "$2,450,000", size: "medium" },
  play: async ({ canvas }) => {
    // Label is CSS-uppercased — DOM text node retains original casing
    await expect(canvas.getByText("Total Contract Value")).toBeInTheDocument();
    await expect(canvas.getByText("$2,450,000")).toBeInTheDocument();
  },
};

export const WithPositiveDelta: Story = {
  args: {
    label: "Budget Remaining",
    value: "$184,200",
    size: "medium",
    delta: { value: "+12.4%", positive: true },
    context: "vs. last month",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("$184,200")).toBeInTheDocument();
    await expect(canvas.getByText("+12.4%", { exact: false })).toBeInTheDocument();
    await expect(canvas.getByText("vs. last month")).toBeInTheDocument();
  },
};

export const WithNegativeDelta: Story = {
  args: {
    label: "Cost Overrun",
    value: "$34,000",
    size: "medium",
    delta: { value: "-8.2%", positive: false },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("-8.2%", { exact: false })).toBeInTheDocument();
  },
};

export const WithProgressBar: Story = {
  args: {
    label: "Budget Used",
    value: "68%",
    size: "medium",
    progress: { value: 68, tone: "neutral" },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("68%")).toBeInTheDocument();
  },
};

export const KpiRowFourMetrics: StoryObj<typeof KpiRow> = {
  render: () => (
    <KpiRow
      metrics={[
        { label: "Contract Value", value: "$2,450,000", size: "medium" },
        { label: "Approved COs", value: "$84,500", size: "medium" },
        { label: "Invoiced to Date", value: "$1,200,000", size: "medium" },
        { label: "Remaining", value: "$1,165,500", size: "medium" },
      ]}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("$2,450,000")).toBeInTheDocument();
    await expect(canvas.getByText("$84,500")).toBeInTheDocument();
    await expect(canvas.getByText("$1,165,500")).toBeInTheDocument();
  },
};
