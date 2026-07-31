import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Copy, ArrowRight, Trash2 } from "lucide-react";
import { TableRowContextMenu } from "./context-menu-pattern";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./status-badge";

const meta: Meta = {
  title: "Actions/ContextMenu",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

const rows = [
  { id: "SC-042", vendor: "Pacific Mechanical Inc.", value: "$485,000", status: "active" },
  { id: "SC-043", vendor: "West Coast Electrical", value: "$312,000", status: "approved" },
  { id: "SC-044", vendor: "Atlas Concrete Group", value: "$198,000", status: "pending" },
];

export const TableRowPattern = {
  name: "Table row context menu",
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contract #</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id} className="group/row">
            <TableCell className="font-medium">{row.id}</TableCell>
            <TableCell>{row.vendor}</TableCell>
            <TableCell className="text-right tabular-nums">{row.value}</TableCell>
            <TableCell><StatusBadge status={row.status} /></TableCell>
            <TableCell>
              <TableRowContextMenu
                actions={[
                  { label: "Open", icon: <ArrowRight className="h-4 w-4" />, onClick: () => {} },
                  { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: () => {} },
                  {
                    label: "Delete",
                    icon: <Trash2 className="h-4 w-4" />,
                    onClick: () => {},
                    destructive: true,
                    separator: true,
                  },
                ]}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const Standalone = {
  render: () => (
    <div className="group/row inline-flex">
      <TableRowContextMenu
        actions={[
          { label: "Edit", onClick: () => {} },
          { label: "Duplicate", icon: <Copy className="h-4 w-4" />, onClick: () => {} },
          { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => {}, destructive: true, separator: true },
        ]}
      />
    </div>
  ),
};
