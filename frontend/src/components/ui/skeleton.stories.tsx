import React from "react";
import type { Meta } from "@storybook/nextjs-vite";
import { Skeleton } from "./skeleton";

const meta: Meta = {
  title: "Feedback/Skeleton",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export default meta;

export const Default = {
  render: () => <Skeleton className="h-4 w-48" />,
};

export const CardLoading = {
  name: "Card loading state",
  render: () => (
    <div className="space-y-3 w-80">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ),
};

export const TableLoading = {
  name: "Table row loading",
  render: () => (
    <div className="space-y-2 w-full max-w-2xl">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  ),
};

export const KpiLoading = {
  name: "KPI cards loading",
  render: () => (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  ),
};
