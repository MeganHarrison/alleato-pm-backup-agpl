import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@/components/ui/input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: { placeholder: "Type here…" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true, placeholder: "Disabled" },
};
