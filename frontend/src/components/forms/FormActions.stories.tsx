import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { FormActions } from "./FormActions";

const meta: Meta = {
  title: "Actions/FormActions",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <FormActions
      submitLabel="Save Contract"
      onCancel={() => {}}
    />
  ),
};

export const Submitting = {
  render: () => (
    <FormActions
      submitLabel="Save Contract"
      isSubmitting
      onCancel={() => {}}
    />
  ),
};

export const AlignStart = {
  render: () => (
    <FormActions
      submitLabel="Submit for Approval"
      cancelLabel="Save as Draft"
      align="start"
      onCancel={() => {}}
    />
  ),
};

export const AlignBetween = {
  render: () => (
    <FormActions
      submitLabel="Save & Continue"
      cancelLabel="Back"
      align="between"
      onCancel={() => {}}
    />
  ),
};

export const WithExtraAction = {
  render: () => (
    <FormActions
      submitLabel="Execute Contract"
      onCancel={() => {}}
    >
      <Button variant="outline">Save as Draft</Button>
    </FormActions>
  ),
};
