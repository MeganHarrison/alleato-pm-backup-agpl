"use client";

import type { ReactElement } from "react";

import {
  UnifiedTablePage,
  type UnifiedTablePageProps,
} from "./unified-table-page";

export interface EmbeddedUnifiedTablePageProps<T>
  extends Omit<UnifiedTablePageProps<T>, "header" | "layout"> {
  title: string;
  description?: UnifiedTablePageProps<T>["header"]["description"];
  layout?: UnifiedTablePageProps<T>["layout"];
}

/**
 * EmbeddedUnifiedTablePage
 *
 * Canonical wrapper for workflow tables that live inside an existing page or tab
 * and should still use the unified table system without rendering a second page
 * header. The hidden header preserves stable table metadata for exports,
 * localStorage, and internal analytics while keeping the visible UI embedded.
 */
export function EmbeddedUnifiedTablePage<T>({
  title,
  description,
  layout,
  ...props
}: EmbeddedUnifiedTablePageProps<T>): ReactElement {
  return (
    <UnifiedTablePage
      {...props}
      header={{
        title,
        description,
        hidden: true,
      }}
      layout={{
        containerPadding: false,
        headerAlignment: "left",
        ...layout,
      }}
    />
  );
}
