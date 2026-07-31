import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { DetailField, DetailFieldGrid } from "./DetailField";

const meta: Meta<typeof DetailField> = {
  component: DetailField,
  tags: ["ai-generated"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof DetailField>;

export const WithValue: Story = {
  args: { label: "Contract Value", value: "$2,450,000" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Contract Value")).toBeInTheDocument();
    await expect(canvas.getByText("$2,450,000")).toBeInTheDocument();
  },
};

export const EmptyValue: Story = {
  args: { label: "Notes", value: "" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Notes")).toBeInTheDocument();
    // Should render the em-dash placeholder
    await expect(canvas.getByText("—")).toBeInTheDocument();
  },
};

export const NullValue: Story = {
  args: { label: "Vendor", value: undefined },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("—")).toBeInTheDocument();
  },
};

export const CustomPlaceholder: Story = {
  args: { label: "Due Date", value: null, emptyPlaceholder: "Not set" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Not set")).toBeInTheDocument();
  },
};

export const GridLayout: StoryObj<typeof DetailFieldGrid> = {
  render: () => (
    <DetailFieldGrid cols={2}>
      <DetailField label="Project" value="Vermillion Rise" />
      <DetailField label="Status" value="Active" />
      <DetailField label="Budget" value="$1,200,000" />
      <DetailField label="Completion" value="Q4 2026" />
    </DetailFieldGrid>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Project")).toBeInTheDocument();
    await expect(canvas.getByText("Vermillion Rise")).toBeInTheDocument();
    await expect(canvas.getByText("Budget")).toBeInTheDocument();
  },
};
