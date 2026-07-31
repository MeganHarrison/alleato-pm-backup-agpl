import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EditModeActions } from "./EditModeActions";

const meta: Meta<typeof EditModeActions> = {
  title: "Actions/EditModeActions",
  component: EditModeActions,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof EditModeActions>;

export const ViewMode: Story = {
  args: {
    isEditing: false,
    onEdit: () => {},
    onSave: () => {},
    onCancel: () => {},
  },
};

export const EditMode: Story = {
  args: {
    isEditing: true,
    onEdit: () => {},
    onSave: () => {},
    onCancel: () => {},
  },
};

export const Saving: Story = {
  args: {
    isEditing: true,
    isSaving: true,
    onEdit: () => {},
    onSave: () => {},
    onCancel: () => {},
  },
};

function InteractiveDemo() {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSaving(false);
    setEditing(false);
  }

  return (
    <EditModeActions
      isEditing={editing}
      isSaving={saving}
      onEdit={() => setEditing(true)}
      onSave={handleSave}
      onCancel={() => setEditing(false)}
    />
  );
}

export const Interactive: Story = { render: () => <InteractiveDemo /> };
