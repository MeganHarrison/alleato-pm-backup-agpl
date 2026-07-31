import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./accordion";

const meta: Meta = {
  title: "Utility/Accordion",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => (
    <Accordion type="single" collapsible className="w-full max-w-lg">
      <AccordionItem value="item-1">
        <AccordionTrigger>What is a prime contract?</AccordionTrigger>
        <AccordionContent>
          A prime contract is the agreement between the owner and the general contractor.
          It defines the scope, schedule, and total contract value for the project.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How are change orders processed?</AccordionTrigger>
        <AccordionContent>
          Change orders modify the original contract scope or price. They require
          approval from both the owner and contractor before work begins.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>What is retainage?</AccordionTrigger>
        <AccordionContent>
          Retainage is a percentage of each progress payment withheld by the owner
          until project completion. Typically 5–10% of the contract value.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};

export const Multiple = {
  render: () => (
    <Accordion type="multiple" className="w-full max-w-lg">
      <AccordionItem value="contracts">
        <AccordionTrigger>Contracts</AccordionTrigger>
        <AccordionContent>
          Manage prime contracts, subcontracts, and purchase orders.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="budget">
        <AccordionTrigger>Budget</AccordionTrigger>
        <AccordionContent>
          Track original budget, approved changes, and cost to complete.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="invoicing">
        <AccordionTrigger>Invoicing</AccordionTrigger>
        <AccordionContent>
          Review pay applications and process payments to subcontractors.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
};
