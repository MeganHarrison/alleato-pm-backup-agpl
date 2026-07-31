/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-30. See PLANE-NOTICE.md.
 *
 * Source:
 * apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/
 * [projectId]/pages/(list)/header.tsx
 * apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/
 * [projectId]/pages/(detail)/header.tsx
 */

"use client";

import type { ReactNode } from "react";
import { Archive, ArchiveRestore, ChevronRight, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { ProjectPage } from "./plane-pages-data";
import { displayPageTitle } from "./plane-pages-utils";

export function PlanePagesListPrimaryHeader({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => Promise<void>;
}) {
  return (
    <header
      data-plane-pages-primary-header
      className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-3"
    >
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">Pages</span>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={isCreating}
        onClick={() => void onCreate()}
        className="h-8 px-3 text-xs"
      >
        {isCreating ? "Adding" : "Add page"}
      </Button>
    </header>
  );
}

export function PlanePageDetailsPrimaryHeader({
  page,
  saveStatus,
  isArchiving,
  onBack,
  onToggleArchived,
}: {
  page: ProjectPage;
  saveStatus: ReactNode;
  isArchiving: boolean;
  onBack: () => void;
  onToggleArchived: () => void;
}) {
  return (
    <header
      data-plane-page-details-header
      className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <button
          type="button"
          onClick={onBack}
          className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <FileText className="size-4 shrink-0" />
          <span>Pages</span>
        </button>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="max-w-64 truncate font-medium text-foreground">
          {displayPageTitle(page.title)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {saveStatus}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isArchiving}
          onClick={onToggleArchived}
          className="h-8 gap-1.5 px-2 text-xs"
        >
          {page.archived ? (
            <ArchiveRestore className="size-3.5" />
          ) : (
            <Archive className="size-3.5" />
          )}
          {page.archived ? "Restore" : "Archive"}
        </Button>
      </div>
    </header>
  );
}
