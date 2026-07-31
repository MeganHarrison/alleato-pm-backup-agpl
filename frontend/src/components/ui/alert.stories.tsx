import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { AlertCircle, CheckCircle, Info, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta = {
  title: "Feedback/Alert",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <Alert>
      <Info />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>
        Changes to the contract value require owner approval before taking effect.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive = {
  render: () => (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Submission failed</AlertTitle>
      <AlertDescription>
        The invoice could not be submitted. Please check your billing period and try again.
      </AlertDescription>
    </Alert>
  ),
};

export const Success = {
  render: () => (
    <Alert variant="success">
      <CheckCircle />
      <AlertTitle>Change order approved</AlertTitle>
      <AlertDescription>
        CO-042 has been approved and added to the contract value.
      </AlertDescription>
    </Alert>
  ),
};

export const Warning = {
  render: () => (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertTitle>Budget threshold reached</AlertTitle>
      <AlertDescription>
        This project has consumed 87% of the approved budget. Review cost-to-complete.
      </AlertDescription>
    </Alert>
  ),
};

export const Info_ = {
  name: "Info",
  render: () => (
    <Alert variant="info">
      <Info />
      <AlertTitle>Pay application period open</AlertTitle>
      <AlertDescription>
        Subcontractors can submit invoices through the end of this billing period.
      </AlertDescription>
    </Alert>
  ),
};

export const AllVariants = {
  name: "All Variants",
  render: () => (
    <div className="space-y-3 max-w-lg">
      <Alert><Info /><AlertTitle>Default</AlertTitle><AlertDescription>Informational message.</AlertDescription></Alert>
      <Alert variant="info"><Info /><AlertTitle>Info</AlertTitle><AlertDescription>Blue info message.</AlertDescription></Alert>
      <Alert variant="success"><CheckCircle /><AlertTitle>Success</AlertTitle><AlertDescription>Action completed successfully.</AlertDescription></Alert>
      <Alert variant="warning"><TriangleAlert /><AlertTitle>Warning</AlertTitle><AlertDescription>Proceed with caution.</AlertDescription></Alert>
      <Alert variant="destructive"><AlertCircle /><AlertTitle>Error</AlertTitle><AlertDescription>Something went wrong.</AlertDescription></Alert>
    </div>
  ),
};
