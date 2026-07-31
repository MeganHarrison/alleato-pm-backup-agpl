"use client";

import * as React from "react";

import { DetailPropertyBar } from "@/components/ui/detail-property-bar";
import { cn } from "@/lib/utils";

import { PageShell, type PageShellProps } from "./page-shell";

/**
 * Canonical shell for operational record-detail pages.
 *
 * Routes supply record-specific data and behavior. This template owns the
 * shared header, action placement, property-bar position, and body rhythm.
 */
export interface RecordDetailPageProps
  extends Omit<PageShellProps, "variant" | "children"> {
  properties?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}

export function RecordDetailPage({
  properties,
  children,
  bodyClassName,
  ...pageShellProps
}: RecordDetailPageProps) {
  return (
    <PageShell variant="detail" {...pageShellProps}>
      <div
        className={cn("space-y-8", bodyClassName)}
        data-testid="record-detail-page"
      >
        {properties ? (
          <DetailPropertyBar data-testid="record-detail-properties">
            {properties}
          </DetailPropertyBar>
        ) : null}
        {children}
      </div>
    </PageShell>
  );
}
