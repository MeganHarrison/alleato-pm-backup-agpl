/**
 * PageLoading — shared skeleton loaders for Next.js route loading.tsx files.
 *
 * Usage:
 *   import { TablePageLoading } from "@/components/layout/PageLoading";
 *   export default function Loading() { return <TablePageLoading />; }
 *
 * Variants:
 *   TablePageLoading  — list/table pages (header + toolbar + rows)
 *   DetailPageLoading — record detail pages with tabs and panels
 *   FormPageLoading   — create/edit form pages (labeled fields)
 */

import { Skeleton } from "@/components/ui/skeleton";

// ─── Table / List Pages ───────────────────────────────────────────────────────

export function TablePageLoading() {
  return (
    <div className="space-y-4 p-6">
      {/* Page header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Toolbar / search row */}
      <Skeleton className="h-10 w-full" />
      {/* Table rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ─── Detail Pages ─────────────────────────────────────────────────────────────

export function DetailPageLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Back + title row */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 w-64" />
      </div>
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      {/* KPI / summary cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      {/* Main content panel */}
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

// ─── Form Pages ───────────────────────────────────────────────────────────────

export function FormPageLoading() {
  return (
    <div className="space-y-6 p-6 max-w-2xl">
      {/* Form title */}
      <Skeleton className="h-8 w-48" />
      {/* Labeled field rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      {/* Submit button row */}
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}
