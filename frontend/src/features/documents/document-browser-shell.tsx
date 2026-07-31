"use client";

import * as React from "react";
import { ArrowLeft, GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useResizableSplit } from "@/features/documents/use-resizable-split";

export interface DocumentBrowserShellProps {
  sidebar?: React.ReactNode;
  mobileSidebar?: React.ReactNode;
  children: React.ReactNode;
  preview: React.ReactNode;
  previewOpen: boolean;
  onClosePreview: () => void;
  splitStorageKey: string;
  defaultRatio?: number;
  className?: string;
}

/**
 * Full-height document browser frame shared by project and global document
 * surfaces. Pages provide content slots; this component owns the flex/overflow
 * contract so a new document surface cannot accidentally introduce a clipped
 * viewport or a second bespoke split layout.
 */
export function DocumentBrowserShell({
  sidebar,
  mobileSidebar,
  children,
  preview,
  previewOpen,
  onClosePreview,
  splitStorageKey,
  defaultRatio = 0.68,
  className,
}: DocumentBrowserShellProps): React.ReactElement {
  const { ratio, onHandleDown, containerRef } = useResizableSplit(
    splitStorageKey,
    defaultRatio,
  );

  return (
    <div
      data-testid="documents-browser-shell"
      data-template="document-browser-shell"
      className={cn(
        "flex h-full min-h-0 flex-1 w-full flex-col overflow-hidden lg:flex-row",
        className,
      )}
    >
      {mobileSidebar ? (
        <div className="shrink-0 border-b border-border lg:hidden">
          {mobileSidebar}
        </div>
      ) : null}

      {sidebar ? (
        <div className="hidden w-44 shrink-0 lg:block">{sidebar}</div>
      ) : null}

      <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1">
        <div
          className="min-h-0 min-w-0 overflow-auto max-lg:flex-1"
          style={{ flexBasis: `${ratio * 100}%` }}
        >
          {children}
        </div>

        <div
          onPointerDown={onHandleDown}
          className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center bg-muted/40 text-muted-foreground lg:flex"
          role="separator"
          aria-label="Resize preview"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>

        <div
          data-testid="document-preview-pane"
          className={cn(
            "min-w-0 overflow-hidden lg:flex-1",
            previewOpen
              ? "fixed inset-0 z-50 flex flex-col bg-background lg:static lg:z-auto lg:block"
              : "hidden lg:block",
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-2 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClosePreview}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to files
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden lg:h-full">
            {preview}
          </div>
        </div>
      </div>
    </div>
  );
}
