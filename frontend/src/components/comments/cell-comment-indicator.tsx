"use client";

import { VeltCommentTool } from "@veltdev/react";

interface CellCommentIndicatorProps {
  rowId: string;
  columnId: string;
}

/**
 * Cell-level comment entry point backed by Velt.
 * The global Velt document scopes the thread to the current page; row/column
 * metadata lets the sidebar group and filter budget-cell comments later.
 */
export function CellCommentIndicator({
  rowId,
  columnId,
}: CellCommentIndicatorProps) {
  return (
    <VeltCommentTool
      sourceId={`budget-cell:${rowId}:${columnId}`}
      targetElementId="app-main-content"
      shadowDom={false}
      context={{
        surface: "budget-table-cell",
        rowId,
        columnId,
      }}
    >
      <span
        aria-label="Comment on cell"
        className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center opacity-0 transition-opacity group-hover/cell:opacity-100"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/35 transition-colors hover:bg-foreground/60" />
      </span>
    </VeltCommentTool>
  );
}
