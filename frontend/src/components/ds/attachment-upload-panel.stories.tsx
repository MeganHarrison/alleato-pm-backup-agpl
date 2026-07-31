import React from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AttachmentUploadPanel, type AttachmentUploadItem } from "./attachment-upload-panel";

const meta: Meta<typeof AttachmentUploadPanel> = {
  title: "Inputs/AttachmentUploadPanel",
  component: AttachmentUploadPanel,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof AttachmentUploadPanel>;

const sampleFiles: AttachmentUploadItem[] = [
  {
    id: "1",
    name: "subcontract-sc-042.pdf",
    sizeBytes: 245760,
    uploadedAtLabel: "Jan 15, 2024",
    downloadUrl: "#",
  },
  {
    id: "2",
    name: "certificate-of-insurance.pdf",
    sizeBytes: 102400,
    uploadedAtLabel: "Jan 16, 2024",
    downloadUrl: "#",
  },
];

export const Empty: Story = {
  args: {
    files: [],
    onUploadFile: async () => {},
  },
};

export const WithFiles: Story = {
  args: {
    files: sampleFiles,
    onUploadFile: async () => {},
    onRemoveFile: async () => {},
  },
};

export const ReadOnly: Story = {
  args: {
    files: sampleFiles,
    onUploadFile: async () => {},
  },
};

export const CustomTitle: Story = {
  args: {
    files: [],
    title: "Contract Documents",
    description: "Upload signed contracts, addenda, and certificates.",
    emptyTitle: "No documents attached",
    emptyDescription: "Attach contract documents to keep everything organized.",
    onUploadFile: async () => {},
  },
};

export const MutedHeader: Story = {
  args: {
    files: sampleFiles,
    headerVariant: "muted",
    title: "Supporting Documents",
    onUploadFile: async () => {},
    onRemoveFile: async () => {},
  },
};
