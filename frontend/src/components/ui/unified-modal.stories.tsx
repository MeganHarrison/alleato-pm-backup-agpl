import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "./unified-modal";

const meta: Meta = {
  title: "Overlays/Modal",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Modal>
      <ModalTrigger asChild>
        <Button>Open Modal</Button>
      </ModalTrigger>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Approve Change Order</ModalTitle>
          <ModalDescription>
            Review and approve CO-042 for $22,500. This will update the contract value.
          </ModalDescription>
        </ModalHeader>
        <div className="py-2 text-sm text-muted-foreground">
          Approval will notify the subcontractor and owner via email.
        </div>
        <ModalFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Approve CO-042</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  ),
};

export const FormModal = {
  render: () => (
    <Modal>
      <ModalTrigger asChild>
        <Button>Create RFI</Button>
      </ModalTrigger>
      <ModalContent size="2xl">
        <ModalHeader>
          <ModalTitle>New Request for Information</ModalTitle>
          <ModalDescription>
            Submit a question or clarification request to the design team.
          </ModalDescription>
        </ModalHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-1">
            <Label>Subject</Label>
            <Input placeholder="Brief description of the question" />
          </div>
          <div className="space-y-1">
            <Label>Assigned to</Label>
            <Input placeholder="Architect / Engineer" />
          </div>
          <div className="space-y-1">
            <Label>Due Date</Label>
            <Input type="date" />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Submit RFI</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  ),
};

export const Sizes = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(["sm", "md", "lg", "xl", "2xl"] as const).map((size) => (
        <Modal key={size}>
          <ModalTrigger asChild>
            <Button variant="outline" size="sm">{size}</Button>
          </ModalTrigger>
          <ModalContent size={size}>
            <ModalHeader>
              <ModalTitle>Modal size: {size}</ModalTitle>
            </ModalHeader>
            <p className="text-sm text-muted-foreground py-2">
              This is a <strong>{size}</strong> modal. Adjust the size prop as needed.
            </p>
            <ModalFooter>
              <Button variant="outline">Close</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      ))}
    </div>
  ),
};
