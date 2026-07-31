import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Badge } from "./badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const meta: Meta = {
  title: "Data Display/Table",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const commitments = [
  { id: "SC-042", vendor: "Pacific Mechanical Inc.", value: "$485,000", billed: "$194,000", status: "active" },
  { id: "SC-043", vendor: "West Coast Electrical", value: "$312,000", billed: "$156,000", status: "active" },
  { id: "SC-044", vendor: "Atlas Concrete Group", value: "$198,000", billed: "$198,000", status: "completed" },
  { id: "SC-045", vendor: "Premier Glass & Glazing", value: "$145,000", billed: "$0", status: "pending" },
];

const statusColor: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
};

export const Default = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contract #</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Contract Value</TableHead>
          <TableHead className="text-right">Billed to Date</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {commitments.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.vendor}</TableCell>
            <TableCell className="text-right tabular-nums">{row.value}</TableCell>
            <TableCell className="text-right tabular-nums">{row.billed}</TableCell>
            <TableCell>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[row.status]}`}>
                {row.status}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right tabular-nums font-semibold">$1,140,000</TableCell>
          <TableCell className="text-right tabular-nums font-semibold">$548,000</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const WithCaption = {
  render: () => (
    <Table>
      <TableCaption>Subcontracts for Vermillion Rise Warehouse — Q1 2024</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Contract #</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {commitments.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.vendor}</TableCell>
            <TableCell className="text-right tabular-nums">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
