import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { EditModeActions } from "./EditModeActions";

const meta: Meta<typeof EditModeActions> = {
  component: EditModeActions,
  tags: ["ai-generated"],
  parameters: { layout: "centered" },
  args: {
    onEdit: fn(),
    onSave: fn(),
    onCancel: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof EditModeActions>;

export const ViewMode: Story = {
  args: { isEditing: false },
  play: async ({ canvas }) => {
    const editBtn = canvas.getByRole("button", { name: /edit/i });
    await expect(editBtn).toBeInTheDocument();
    await expect(editBtn).toBeEnabled();
  },
};

export const EditMode: Story = {
  args: { isEditing: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /save/i })).toBeInTheDocument();
  },
};

export const SavingState: Story = {
  args: { isEditing: true, isSaving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /saving/i })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: /cancel/i })).toBeDisabled();
  },
};

export const CustomLabels: Story = {
  args: {
    isEditing: false,
    editLabel: "Modify",
    saveLabel: "Confirm",
    cancelLabel: "Discard",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: /modify/i })).toBeInTheDocument();
  },
};

export const ClickEditCallsHandler: Story = {
  args: { isEditing: false },
  play: async ({ canvas, args }) => {
    const editBtn = canvas.getByRole("button", { name: /edit/i });
    await editBtn.click();
    await expect(args.onEdit).toHaveBeenCalledOnce();
  },
};
