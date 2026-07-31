import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Button } from "./button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

const meta: Meta = {
  title: "Overlays/Drawer",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export default meta;

export const Default = {
  render: () => (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">Open Drawer</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick Actions</DrawerTitle>
          <DrawerDescription>
            Select an action for this change order.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 space-y-2 pb-2">
          {["Approve", "Request Revision", "Reject", "Export PDF"].map((action) => (
            <Button key={action} variant="outline" className="w-full justify-start">
              {action}
            </Button>
          ))}
        </div>
        <DrawerFooter>
          <Button variant="outline">Cancel</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  ),
};
