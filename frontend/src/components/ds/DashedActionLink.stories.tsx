import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Plus, FileText, Users, DollarSign } from "lucide-react";
import { DashedActionLink } from "./dashed-action-link";

const meta: Meta = {
  title: "Actions/DashedActionLink",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <div className="w-72">
      <DashedActionLink href="#">
        Add a new subcontract
      </DashedActionLink>
    </div>
  ),
};

export const WithIcon = {
  render: () => (
    <div className="w-72">
      <DashedActionLink href="#" icon={<Plus className="h-4 w-4" />}>
        Create change order
      </DashedActionLink>
    </div>
  ),
};

export const List = {
  render: () => (
    <div className="w-72 space-y-2">
      <DashedActionLink href="#" icon={<Plus className="h-4 w-4" />}>
        Add subcontract
      </DashedActionLink>
      <DashedActionLink href="#" icon={<FileText className="h-4 w-4" />}>
        Upload contract document
      </DashedActionLink>
      <DashedActionLink href="#" icon={<Users className="h-4 w-4" />}>
        Add team members
      </DashedActionLink>
      <DashedActionLink href="#" icon={<DollarSign className="h-4 w-4" />}>
        Configure budget line items
      </DashedActionLink>
    </div>
  ),
};
