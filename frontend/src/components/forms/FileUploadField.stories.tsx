import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileUploadField } from "./FileUploadField";

const meta: Meta<typeof FileUploadField> = {
  title: "Inputs/FileUploadField",
  component: FileUploadField,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof FileUploadField>;

export const Default: Story = {
  args: {
    label: "Contract Document",
  },
};

export const Required: Story = {
  args: {
    label: "Signed Contract",
    required: true,
    hint: "Upload the fully executed contract PDF.",
    accept: ".pdf",
  },
};

export const MultipleFiles: Story = {
  args: {
    label: "Supporting Documents",
    multiple: true,
    hint: "Upload certificates, drawings, or specifications.",
    accept: ".pdf,.doc,.docx,.dwg",
  },
};

export const WithFiles: Story = {
  args: {
    label: "Attachments",
    multiple: true,
    value: [
      { name: "subcontract-sc-042.pdf", size: 245760, type: "application/pdf" },
      { name: "certificate-of-insurance.pdf", size: 102400, type: "application/pdf" },
    ],
  },
};

export const WithError: Story = {
  args: {
    label: "Lien Waiver",
    required: true,
    error: "A signed lien waiver is required before processing this payment.",
  },
};

export const Minimal: Story = {
  args: {
    label: "Photo",
    variant: "minimal",
    accept: "image/*",
  },
};
