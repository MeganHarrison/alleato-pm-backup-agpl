/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Direct Next.js adaptation of Plane v1.3.1:
 * - apps/web/app/(all)/[workspaceSlug]/(projects)/stickies/header.tsx
 * - apps/web/core/components/stickies/layout/stickies-list.tsx
 * - apps/web/core/components/stickies/sticky/root.tsx
 * - apps/web/core/components/editor/sticky-editor/color-palette.tsx
 */

"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Palette,
  Pin,
  PinOff,
  Plus,
  RotateCcw,
  StickyNote as StickyNoteIcon,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { InfoAlert } from "@/components/ds/InfoAlert";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { PlaneDropdownMenuContent } from "@/features/plane-work-items/plane-overlay";
import { ExpandableSearch } from "@/components/tables/unified/table-toolbar";
import { cn } from "@/lib/utils";

import {
  PLANE_STICKY_COLORS,
  type PlaneSticky,
  type PlaneStickyColor,
  type PlaneStickyScope,
} from "./plane-stickies-contract";
import { planeStickiesApi, type PlaneStickiesApi } from "./plane-stickies-api";

const COLOR_STYLES: Record<PlaneStickyColor, string> = {
  gray: "var(--editor-colors-gray-background, #f1f2f4)",
  peach: "var(--editor-colors-peach-background, #fce8d5)",
  pink: "var(--editor-colors-pink-background, #f8dce7)",
  orange: "var(--editor-colors-orange-background, #f9dfb8)",
  green: "var(--editor-colors-green-background, #dcebdc)",
  "light-blue": "var(--editor-colors-light-blue-background, #dcebf5)",
  "dark-blue": "var(--editor-colors-dark-blue-background, #cddff1)",
  purple: "var(--editor-colors-purple-background, #e7ddf5)",
};

const SCOPE_LABELS: Record<PlaneStickyScope, string> = {
  personal: "Personal",
  workspace: "Workspace",
  project: "Project",
};

const EMPTY_OWNER_ID = "00000000-0000-4000-8000-000000000000";

export function orderPlaneStickies(stickies: PlaneSticky[]): PlaneSticky[] {
  return [...stickies].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) return left.is_pinned ? -1 : 1;
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }
    const updated = right.updated_at.localeCompare(left.updated_at);
    return updated || left.id.localeCompare(right.id);
  });
}

function mutationMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}

function PlaneStickyCard({
  sticky,
  busy,
  onDelete,
  onUpdate,
}: {
  sticky: PlaneSticky;
  busy: boolean;
  onDelete: (sticky: PlaneSticky) => Promise<void>;
  onUpdate: (
    sticky: PlaneSticky,
    changes: {
      content?: string;
      background_color?: PlaneStickyColor;
      is_pinned?: boolean;
      archived?: boolean;
    },
  ) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState(sticky.content);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => setDraft(sticky.content), [sticky.content]);

  return (
    <>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sticky?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the sticky. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onDelete(sticky)}
            >
              Delete sticky
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <article
        data-plane-sticky-card={sticky.id}
        className="group/sticky mb-3 inline-flex min-h-64 w-full break-inside-avoid flex-col overflow-hidden rounded-sm text-foreground"
        style={{ backgroundColor: COLOR_STYLES[sticky.background_color] }}
      >
        <div className="flex min-h-11 items-center justify-between px-2 md:min-h-9">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {sticky.is_pinned ? <Pin className="size-3.5" /> : null}
            {sticky.is_pinned ? "Pinned" : "Sticky"}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Sticky actions"
                disabled={busy}
                className="size-11 bg-transparent opacity-70 hover:bg-black/5 group-hover/sticky:opacity-100 md:size-8"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <PlaneDropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                onClick={() =>
                  void onUpdate(sticky, { is_pinned: !sticky.is_pinned })
                }
              >
                {sticky.is_pinned ? (
                  <PinOff className="size-4" />
                ) : (
                  <Pin className="size-4" />
                )}
                {sticky.is_pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Background color</DropdownMenuLabel>
              {PLANE_STICKY_COLORS.map((color) => (
                <DropdownMenuItem
                  key={color}
                  className="min-h-11 capitalize md:min-h-8"
                  onClick={() =>
                    void onUpdate(sticky, { background_color: color })
                  }
                >
                  <span
                    className="size-4 rounded-sm border border-black/10"
                    style={{ backgroundColor: COLOR_STYLES[color] }}
                  />
                  {color.replace("-", " ")}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="min-h-11 md:min-h-8"
                onClick={() =>
                  void onUpdate(sticky, { archived: !sticky.archived_at })
                }
              >
                {sticky.archived_at ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
                {sticky.archived_at ? "Restore" : "Archive"}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11 text-destructive focus:text-destructive md:min-h-8"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </PlaneDropdownMenuContent>
          </DropdownMenu>
        </div>

        <Textarea
          aria-label="Sticky content"
          value={draft}
          disabled={busy}
          placeholder="Click to type here"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (draft !== sticky.content) {
              void onUpdate(sticky, { content: draft });
            }
          }}
          className="min-h-52 flex-1 resize-none rounded-none border-0 bg-transparent p-4 text-base leading-6 shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm"
        />

        <div className="flex min-h-11 items-center justify-end gap-1 px-2 md:min-h-9">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Change color from ${sticky.background_color}`}
            disabled={busy}
            className="size-11 bg-transparent hover:bg-black/5 md:size-8"
            onClick={() => {
              const index = PLANE_STICKY_COLORS.indexOf(
                sticky.background_color,
              );
              const next =
                PLANE_STICKY_COLORS[(index + 1) % PLANE_STICKY_COLORS.length];
              void onUpdate(sticky, { background_color: next });
            }}
          >
            <Palette className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={sticky.is_pinned ? "Unpin sticky" : "Pin sticky"}
            disabled={busy}
            className="size-11 bg-transparent hover:bg-black/5 md:size-8"
            onClick={() =>
              void onUpdate(sticky, { is_pinned: !sticky.is_pinned })
            }
          >
            {sticky.is_pinned ? (
              <PinOff className="size-4" />
            ) : (
              <Pin className="size-4" />
            )}
          </Button>
        </div>
      </article>
    </>
  );
}

export function PlaneStickiesPage({
  workspaceKey = "alleato",
  projectId,
  api = planeStickiesApi,
}: {
  workspaceKey?: string;
  projectId?: number;
  api?: PlaneStickiesApi;
}) {
  const [scope, setScope] = React.useState<PlaneStickyScope>(
    projectId ? "project" : "workspace",
  );
  const [showArchived, setShowArchived] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [stickies, setStickies] = React.useState<PlaneSticky[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const mutationTokens = React.useRef(new Map<string, number>());
  const loadSequence = React.useRef(0);

  const resolvedProjectId = scope === "project" ? projectId : undefined;

  const load = React.useCallback(async () => {
    const requestSequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const next = await api.list({
        workspaceKey,
        scope,
        projectId: resolvedProjectId,
        archived: showArchived,
      });
      if (requestSequence !== loadSequence.current) return;
      setStickies(orderPlaneStickies(next));
    } catch (loadError) {
      if (requestSequence !== loadSequence.current) return;
      setError(mutationMessage(loadError, "Could not load stickies."));
    } finally {
      if (requestSequence === loadSequence.current) {
        setLoading(false);
      }
    }
  }, [api, resolvedProjectId, scope, showArchived, workspaceKey]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createSticky = async () => {
    if (scope === "project" && !projectId) {
      setError("Select a project before creating a project sticky.");
      return;
    }
    setCreating(true);
    setError(null);
    const now = new Date().toISOString();
    const optimisticId = crypto.randomUUID();
    const optimistic: PlaneSticky = {
      id: optimisticId,
      owner_id: EMPTY_OWNER_ID,
      workspace_key: workspaceKey,
      scope,
      project_id: scope === "project" ? (projectId ?? null) : null,
      content: "",
      background_color: "gray",
      sort_order: 65_535,
      is_pinned: false,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };
    setBusyIds((current) => new Set(current).add(optimisticId));
    setStickies((current) => orderPlaneStickies([optimistic, ...current]));
    try {
      const created = await api.create({
        workspace_key: workspaceKey,
        scope,
        project_id: optimistic.project_id,
        content: "",
        background_color: "gray",
        sort_order: optimistic.sort_order,
      });
      setStickies((current) =>
        orderPlaneStickies(
          current.map((sticky) =>
            sticky.id === optimisticId ? created : sticky,
          ),
        ),
      );
    } catch (createError) {
      setStickies((current) =>
        current.filter((sticky) => sticky.id !== optimisticId),
      );
      setError(mutationMessage(createError, "Could not create the sticky."));
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(optimisticId);
        return next;
      });
      setCreating(false);
    }
  };

  const updateSticky = async (
    sticky: PlaneSticky,
    changes: {
      content?: string;
      background_color?: PlaneStickyColor;
      is_pinned?: boolean;
      archived?: boolean;
    },
  ) => {
    const token = (mutationTokens.current.get(sticky.id) ?? 0) + 1;
    mutationTokens.current.set(sticky.id, token);
    setBusyIds((current) => new Set(current).add(sticky.id));
    setError(null);
    const { archived, ...localChanges } = changes;
    const optimistic: PlaneSticky = {
      ...sticky,
      ...localChanges,
      ...(typeof archived === "boolean"
        ? { archived_at: archived ? new Date().toISOString() : null }
        : {}),
      updated_at: new Date().toISOString(),
    };
    setStickies((current) =>
      orderPlaneStickies(
        current.map((item) => (item.id === sticky.id ? optimistic : item)),
      ),
    );
    try {
      const updated = await api.update({ id: sticky.id, ...changes });
      if (mutationTokens.current.get(sticky.id) !== token) return;
      setStickies((current) => {
        if (Boolean(updated.archived_at) !== showArchived) {
          return current.filter((item) => item.id !== sticky.id);
        }
        return orderPlaneStickies(
          current.map((item) => (item.id === sticky.id ? updated : item)),
        );
      });
    } catch (updateError) {
      if (mutationTokens.current.get(sticky.id) === token) {
        setStickies((current) =>
          orderPlaneStickies(
            current.map((item) => (item.id === sticky.id ? sticky : item)),
          ),
        );
        setError(mutationMessage(updateError, "Could not update the sticky."));
      }
    } finally {
      if (mutationTokens.current.get(sticky.id) === token) {
        setBusyIds((current) => {
          const next = new Set(current);
          next.delete(sticky.id);
          return next;
        });
      }
    }
  };

  const deleteSticky = async (sticky: PlaneSticky) => {
    setBusyIds((current) => new Set(current).add(sticky.id));
    setError(null);
    setStickies((current) => current.filter((item) => item.id !== sticky.id));
    try {
      await api.remove(sticky.id);
    } catch (deleteError) {
      setStickies((current) => orderPlaneStickies([...current, sticky]));
      setError(mutationMessage(deleteError, "Could not delete the sticky."));
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(sticky.id);
        return next;
      });
    }
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleStickies = normalizedQuery
    ? stickies.filter((sticky) =>
        sticky.content.toLocaleLowerCase().includes(normalizedQuery),
      )
    : stickies;

  return (
    <section
      data-plane-stickies-page
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
    >
      <header className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
          <StickyNoteIcon className="size-5 shrink-0 rotate-90 text-muted-foreground" />
          <span className="truncate font-medium text-foreground">Stickies</span>
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <ExpandableSearch
            value={query}
            onChange={setQuery}
            placeholder="Search stickies"
            ariaLabel="Search stickies"
            className="min-w-0 [&_button]:size-11 md:[&_button]:size-8"
            inputClassName="h-11 w-40 text-base sm:w-64 md:h-8 md:text-sm"
            triggerClassName="size-11 md:size-8"
          />
          <Button
            type="button"
            size="sm"
            disabled={creating}
            onClick={() => void createSticky()}
            className="h-11 gap-1.5 px-3 text-xs md:h-8"
          >
            <Plus className="size-3.5" />
            <span className="hidden sm:inline">
              {creating ? "Adding" : "Add sticky"}
            </span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-border/60 px-2 sm:px-3">
        <div className="flex h-full items-stretch">
          {(Object.keys(SCOPE_LABELS) as PlaneStickyScope[]).map((value) => {
            const disabled = value === "project" && !projectId;
            return (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                title={
                  disabled ? "Open Stickies from a project first." : undefined
                }
                onClick={() => setScope(value)}
                className={cn(
                  "relative h-full min-h-11 rounded-none px-3 text-[13px] font-medium text-muted-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t after:bg-transparent sm:px-4",
                  scope === value && "text-primary after:bg-primary",
                  disabled && "cursor-not-allowed opacity-40",
                )}
              >
                {SCOPE_LABELS[value]}
              </Button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 shrink-0 gap-1.5 text-xs md:h-8"
          onClick={() => setShowArchived((current) => !current)}
        >
          {showArchived ? (
            <ArchiveRestore className="size-3.5" />
          ) : (
            <Archive className="size-3.5" />
          )}
          {showArchived ? "Active" : "Archived"}
        </Button>
      </div>

      {error ? (
        <InfoAlert
          role="alert"
          variant="error"
          className="min-h-11 rounded-none border-x-0 border-t-0 py-0"
        >
          <div className="flex min-h-11 w-full items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              className="h-10 shrink-0 gap-1.5 text-destructive hover:text-destructive md:h-8"
            >
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          </div>
        </InfoAlert>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {loading ? (
          <div
            aria-label="Loading stickies"
            className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6"
          >
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="mb-3 inline-block h-64 w-full animate-pulse break-inside-avoid rounded-sm bg-muted"
              />
            ))}
          </div>
        ) : visibleStickies.length === 0 ? (
          <div className="grid min-h-full place-items-center px-6 py-14">
            <div className="max-w-sm text-center">
              <StickyNoteIcon className="mx-auto size-9 rotate-90 text-muted-foreground/60" />
              <p className="mt-4 text-sm font-semibold text-foreground">
                {query
                  ? "No matching stickies"
                  : showArchived
                    ? "No archived stickies"
                    : "Create your first sticky"}
              </p>
              <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                {query
                  ? "Try a different search term."
                  : showArchived
                    ? "Archived stickies will appear here."
                    : "Capture a thought and keep it close to your work."}
              </p>
              {!query && !showArchived ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={creating}
                  onClick={() => void createSticky()}
                  className="mt-5 min-h-11 md:min-h-8"
                >
                  <Plus className="size-3.5" />
                  Add sticky
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6">
            {visibleStickies.map((sticky) => (
              <PlaneStickyCard
                key={sticky.id}
                sticky={sticky}
                busy={busyIds.has(sticky.id)}
                onDelete={deleteSticky}
                onUpdate={updateSticky}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
