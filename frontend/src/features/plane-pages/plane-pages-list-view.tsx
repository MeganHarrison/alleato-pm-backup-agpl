/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-30. See PLANE-NOTICE.md.
 */

"use client";

import * as React from "react";
import {
  Archive,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Earth,
  FileText,
  Info,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PlaneDropdownMenuContent } from "@/features/plane-work-items/plane-overlay";
import { cn } from "@/lib/utils";

import type { ProjectPage } from "./plane-pages-data";
import { PlanePagesListPrimaryHeader } from "./plane-pages-header";
import {
  displayPageTitle,
  formatPageUpdatedAt,
  type PageScope,
  type PageSortKey,
  type PageSortOrder,
} from "./plane-pages-utils";

const tabs: Array<{
  key: "public" | "private" | "archived";
  label: string;
}> = [
  { key: "public", label: "Public" },
  { key: "private", label: "Private" },
  { key: "archived", label: "Archived" },
];

const sortLabels: Record<PageSortKey, string> = {
  title: "Name",
  created_at: "Date created",
  updated_at: "Date modified",
};

export function PlanePagesListView({
  pages,
  hasAnyPages,
  scope,
  query,
  sortKey,
  sortOrder,
  isCreating,
  onArchive,
  onCreate,
  onQueryChange,
  onScopeChange,
  onSelect,
  onSortKeyChange,
  onSortOrderChange,
}: {
  pages: ProjectPage[];
  hasAnyPages: boolean;
  scope: PageScope;
  query: string;
  sortKey: PageSortKey;
  sortOrder: PageSortOrder;
  isCreating: boolean;
  onArchive: (page: ProjectPage) => Promise<void>;
  onCreate: () => Promise<void>;
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: PageScope) => void;
  onSelect: (page: ProjectPage) => void;
  onSortKeyChange: (sortKey: PageSortKey) => void;
  onSortOrderChange: (sortOrder: PageSortOrder) => void;
}) {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const activeTab = scope === "archived" ? "archived" : "public";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <PlanePagesListPrimaryHeader
        isCreating={isCreating}
        onCreate={onCreate}
      />

      {hasAnyPages ? (
        <div
          data-plane-pages-secondary-header
          className="flex h-12 shrink-0 items-stretch justify-between border-b border-border/60 px-2 sm:px-3"
        >
          <div className="flex h-full items-stretch">
            {tabs.map((tab) => {
              const isActive = tab.key === activeTab;
              const isPrivate = tab.key === "private";

              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={isPrivate}
                  title={
                    isPrivate
                      ? "Private pages require an access field that public.notes does not currently provide."
                      : undefined
                  }
                  onClick={() =>
                    onScopeChange(
                      tab.key === "archived" ? "archived" : "active",
                    )
                  }
                  className={cn(
                    "relative flex h-full items-center justify-center px-3 text-[13px] font-medium text-muted-foreground transition-colors sm:px-4",
                    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t after:bg-transparent",
                    isActive && "text-primary after:bg-primary",
                    isPrivate && "cursor-not-allowed opacity-45",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex min-w-0 items-center gap-1">
            <div
              className={cn(
                "flex items-center overflow-hidden transition-[width] duration-200",
                isSearchOpen ? "w-44 sm:w-64" : "w-8",
              )}
            >
              {isSearchOpen ? (
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        onQueryChange("");
                        setIsSearchOpen(false);
                      }
                    }}
                    placeholder="Search pages"
                    aria-label="Search pages"
                    className="h-8 pl-8 pr-8 text-[13px]"
                  />
                  <button
                    type="button"
                    aria-label="Close search"
                    onClick={() => {
                      onQueryChange("");
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-2 top-1/2 grid size-4 -translate-y-1/2 place-items-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Search pages"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search className="size-3.5" />
                </Button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="hidden h-8 gap-1.5 text-xs sm:flex"
                >
                  {sortOrder === "desc" ? (
                    <ArrowDownWideNarrow className="size-3.5" />
                  ) : (
                    <ArrowUpWideNarrow className="size-3.5" />
                  )}
                  {sortLabels[sortKey]}
                </Button>
              </DropdownMenuTrigger>
              <PlaneDropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Order pages by</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sortKey}
                  onValueChange={(value) =>
                    onSortKeyChange(value as PageSortKey)
                  }
                >
                  {(
                    Object.entries(sortLabels) as Array<[PageSortKey, string]>
                  ).map(([key, label]) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={sortOrder}
                  onValueChange={(value) =>
                    onSortOrderChange(value as PageSortOrder)
                  }
                >
                  <DropdownMenuRadioItem value="asc">
                    Ascending
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">
                    Descending
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </PlaneDropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {pages.length === 0 ? (
          <div className="grid min-h-full place-items-center px-6 py-14">
            <div className="max-w-sm text-center">
              <FileText className="mx-auto size-9 text-muted-foreground/60" />
              <p className="mt-4 text-sm font-semibold text-foreground">
                {query
                  ? "No matching pages"
                  : scope === "archived"
                    ? "No archived pages"
                    : "Create your first page"}
              </p>
              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                {query
                  ? "Try a different search term."
                  : scope === "archived"
                    ? "Archived pages will appear here."
                    : "Write project notes, decisions, and shared context in one place."}
              </p>
              {!query && scope === "active" ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={isCreating}
                  onClick={() => void onCreate()}
                  className="mt-5"
                >
                  <Plus className="size-3.5" />
                  Add page
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col">
            {pages.map((page) => (
              <div
                key={page.id}
                className="group relative flex min-h-[52px] w-full items-center justify-between gap-4 border-b border-border/55 px-4 text-[13px] transition-colors hover:bg-muted/35 sm:px-6"
              >
                <button
                  type="button"
                  onClick={() => onSelect(page)}
                  className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden text-left"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">
                    {displayPageTitle(page.title)}
                  </span>
                </button>

                <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                  <span
                    className="hidden size-6 place-items-center rounded-full bg-muted text-[10px] font-medium sm:grid"
                    title={`Owner ${page.created_by ?? "unknown"}`}
                  >
                    {page.created_by?.slice(0, 2).toUpperCase() ?? "?"}
                  </span>
                  <Earth
                    className="hidden size-4 sm:block"
                    aria-label="Public"
                  />
                  <span className="hidden h-5 w-px bg-border sm:block" />
                  <span
                    className="hidden sm:inline"
                    title={`Updated ${formatPageUpdatedAt(page.updated_at ?? page.created_at)}`}
                  >
                    <Info className="size-4" />
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${displayPageTitle(page.title)}`}
                        onClick={(event) => event.stopPropagation()}
                        className="opacity-70 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <PlaneDropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onSelect(page)}>
                        Open page
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => void onArchive(page)}>
                        <Archive className="size-4" />
                        {page.archived ? "Restore" : "Archive"}
                      </DropdownMenuItem>
                    </PlaneDropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
