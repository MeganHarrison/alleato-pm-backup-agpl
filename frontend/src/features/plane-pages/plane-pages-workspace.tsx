/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * Adapted for Alleato on 2026-07-30. See PLANE-NOTICE.md.
 */

"use client";

import * as React from "react";

import { ErrorState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import {
  createProjectNotesEditorAdapter,
  PlanePagesEditor,
} from "@/features/plane-pages-editor";

import {
  createProjectPage,
  listProjectPages,
  type ProjectPage,
  updateProjectPage,
} from "./plane-pages-data";
import { PlanePagesListView } from "./plane-pages-list-view";
import {
  applyPageArchiveResult,
  displayPageTitle,
  filterProjectPages,
  type PageScope,
  type PageSortKey,
  type PageSortOrder,
  sortProjectPages,
} from "./plane-pages-utils";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "An unexpected page error occurred.";
}

export function PlanePagesWorkspace({ projectId }: { projectId: number }) {
  const [pages, setPages] = React.useState<ProjectPage[]>([]);
  const [selectedPageId, setSelectedPageId] = React.useState<number | null>(
    null,
  );
  const [scope, setScope] = React.useState<PageScope>("active");
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<PageSortKey>("updated_at");
  const [sortOrder, setSortOrder] = React.useState<PageSortOrder>("desc");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadPages = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const loadedPages = await listProjectPages(projectId);
      setPages(loadedPages);
      setSelectedPageId((current) =>
        current && loadedPages.some((page) => page.id === current)
          ? current
          : null,
      );
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void loadPages();
  }, [loadPages]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null;

  const openPage = React.useCallback((page: ProjectPage) => {
    setSelectedPageId(page.id);
  }, []);

  const editorAdapter = React.useMemo(
    () =>
      createProjectNotesEditorAdapter({
        projectId,
        onPageSaved: (savedPage) => {
          setPages((current) =>
            current.map((page) =>
              page.id === savedPage.id ? savedPage : page,
            ),
          );
        },
      }),
    [projectId],
  );

  const visiblePages = React.useMemo(
    () =>
      sortProjectPages(
        filterProjectPages(pages, scope, query),
        sortKey,
        sortOrder,
      ),
    [pages, query, scope, sortKey, sortOrder],
  );

  const handleCreate = React.useCallback(async () => {
    setIsCreating(true);
    setActionError(null);
    try {
      const created = await createProjectPage(projectId);
      setPages((current) => [created, ...current]);
      setScope("active");
      setQuery("");
      openPage(created);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }, [openPage, projectId]);

  const handleArchive = React.useCallback(
    async (page: ProjectPage) => {
      const nextArchived = !page.archived;
      if (
        nextArchived &&
        !window.confirm(`Archive "${displayPageTitle(page.title)}"?`)
      ) {
        return;
      }

      setIsArchiving(true);
      setActionError(null);
      try {
        const updated = await updateProjectPage(projectId, page.id, {
          archived: nextArchived,
        });
        const transition = applyPageArchiveResult(pages, updated);
        setPages(transition.pages);
        setSelectedPageId(transition.selectedPageId);
        setScope(transition.scope);
      } catch (error) {
        setActionError(errorMessage(error));
      } finally {
        setIsArchiving(false);
      }
    },
    [pages, projectId],
  );

  if (isLoading) {
    return (
      <div
        className="h-full min-h-96 bg-background"
        aria-label="Loading pages"
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center bg-background p-6">
        <ErrorState
          title="Pages could not load"
          description={loadError}
          onRetry={() => void loadPages()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {actionError ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 border-b border-destructive/30 px-4 py-3 text-sm text-destructive"
        >
          <span>{actionError}</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setActionError(null)}
            className="text-destructive"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {selectedPage ? (
        <PlanePagesEditor
          pageId={String(selectedPage.id)}
          adapter={editorAdapter}
          onBack={() => setSelectedPageId(null)}
          archiveAction={{
            archived: Boolean(selectedPage.archived),
            isWorking: isArchiving,
            onToggle: () => void handleArchive(selectedPage),
          }}
        />
      ) : (
        <PlanePagesListView
          pages={visiblePages}
          hasAnyPages={pages.length > 0}
          scope={scope}
          query={query}
          sortKey={sortKey}
          sortOrder={sortOrder}
          isCreating={isCreating}
          onArchive={handleArchive}
          onCreate={handleCreate}
          onQueryChange={setQuery}
          onScopeChange={setScope}
          onSelect={openPage}
          onSortKeyChange={setSortKey}
          onSortOrderChange={setSortOrder}
        />
      )}
    </div>
  );
}
