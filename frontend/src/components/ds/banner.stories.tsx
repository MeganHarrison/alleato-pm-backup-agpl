import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { Banner } from "./banner";

const meta: Meta = {
  title: "Feedback/Banner",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Info = {
  render: () => (
    <Banner variant="info">
      The billing period closes on January 31st. Submit all invoices before midnight.
    </Banner>
  ),
};

export const Warning = {
  render: () => (
    <Banner variant="warning" title="Budget threshold reached">
      This project has consumed 87% of the approved budget. Review cost-to-complete before approving additional change orders.
    </Banner>
  ),
};

export const Success = {
  render: () => (
    <Banner variant="success" title="Contract executed">
      SC-042 has been executed and is now active. Subcontractor has been notified via email.
    </Banner>
  ),
};

export const Error = {
  render: () => (
    <Banner variant="error" title="Sync failed">
      Failed to sync with Acumatica. Financial data may be out of date. Retry or contact support.
    </Banner>
  ),
};

export const WithAction = {
  render: () => (
    <Banner
      variant="warning"
      title="Retainage overdue"
      action={<Button size="sm" variant="outline">Review</Button>}
    >
      3 subcontracts have retainage that should have been released at substantial completion.
    </Banner>
  ),
};

function DismissibleDemo() {
  const [visible, setVisible] = React.useState(true);
  if (!visible) return (
    <Button variant="outline" size="sm" onClick={() => setVisible(true)}>Show banner</Button>
  );
  return (
    <Banner variant="info" onDismiss={() => setVisible(false)}>
      New feature: Voice-to-record is now available on mobile. Tap the mic icon in the chat.
    </Banner>
  );
}

export const Dismissible = { render: () => <DismissibleDemo /> };

export const AllVariants = {
  name: "All variants",
  render: () => (
    <div className="space-y-2">
      <Banner variant="info">Informational system message.</Banner>
      <Banner variant="warning">Warning — action may be required.</Banner>
      <Banner variant="success">Operation completed successfully.</Banner>
      <Banner variant="error">Something went wrong. Please try again.</Banner>
    </div>
  ),
};
