import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta: Meta = {
  title: "Overlays/Dialog",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project Name</DialogTitle>
          <DialogDescription>
            Update the display name for this project. This will be visible to all team members.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Project Name</Label>
            <Input defaultValue="Vermillion Rise Warehouse" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Notification = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Confirm Action</Button>
      </DialogTrigger>
      <DialogContent size="notification">
        <DialogHeader>
          <DialogTitle>Submit for Approval</DialogTitle>
          <DialogDescription>
            This change order will be sent to the owner for review. You cannot edit it after submission.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WideForm = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open Large Form</Button>
      </DialogTrigger>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>Create Subcontract</DialogTitle>
          <DialogDescription>
            Enter the details for the new subcontract agreement.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1">
            <Label>Vendor</Label>
            <Input placeholder="Select vendor..." />
          </div>
          <div className="space-y-1">
            <Label>Contract Value</Label>
            <Input placeholder="" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Create Subcontract</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
