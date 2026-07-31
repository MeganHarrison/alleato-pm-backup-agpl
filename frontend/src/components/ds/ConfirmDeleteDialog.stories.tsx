import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

const meta: Meta<typeof ConfirmDeleteDialog> = {
  title: "Overlays/ConfirmDeleteDialog",
  component: ConfirmDeleteDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof ConfirmDeleteDialog>;

export const Open: Story = {
  args: {
    open: true,
    itemName: "Change Order #CO-042",
    onConfirm: () => {},
    onOpenChange: () => {},
  },
};

export const CustomDescription: Story = {
  args: {
    open: true,
    title: "Delete this budget line?",
    description:
      "Removing this line will affect your project totals. All associated change orders will be unlinked.",
    confirmLabel: "Yes, delete it",
    onConfirm: () => {},
    onOpenChange: () => {},
  },
};

export const Deleting: Story = {
  args: {
    open: true,
    itemName: "Subcontract #SC-007",
    isDeleting: true,
    onConfirm: () => {},
    onOpenChange: () => {},
  },
};

function WithTriggerDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete Record
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        itemName="Invoice #INV-2024-001"
        onConfirm={() => setOpen(false)}
      />
    </>
  );
}

export const WithTrigger: Story = { render: () => <WithTriggerDemo /> };
