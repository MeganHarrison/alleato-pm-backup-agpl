/**
 * Adapted from Plane v1.3.1 workspace sidebar Favorites patterns.
 *
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See PROVENANCE.md, LICENSES/NOTICE-PLANE.md, and /auth/source.
 */

"use client";

import { CircleAlert, Clock3, RotateCw, Star, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlaneWorkspaceSurface } from "@/features/plane-work-items/plane-workspace-shell";
import {
  listPlaneWorkspaceItems,
  removePlaneWorkspaceItem,
  savePlaneWorkspaceItem,
  type PlaneWorkspaceItem,
} from "@/features/plane-workspace-items";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const PLANE_WORKSPACE_KEY = "alleato";
export const INVALID_PLANE_PROJECT_CONTEXT_MESSAGE =
  "Favorites and Recents are unavailable because this project context is invalid.";

export function isValidPlaneWorkspaceProjectId(projectId: number): boolean {
  return Number.isSafeInteger(projectId) && projectId > 0;
}

const SURFACE_LABELS: Record<PlaneWorkspaceSurface, string> = {
  home: "Home",
  projects: "Projects",
  "your-work": "Your work",
  drafts: "Drafts",
  "work-items": "Work items",
  cycles: "Cycles",
  modules: "Modules",
  views: "Views",
  pages: "Pages",
  intake: "Intake",
  rfis: "RFIs",
  submittals: "Submittals",
  "change-events": "Change Events",
  commitments: "Commitments",
  "prime-contracts": "Prime Contracts",
};

const SURFACE_ENTITY_TYPES: Record<PlaneWorkspaceSurface, string> = {
  home: "project",
  projects: "project",
  "your-work": "project",
  drafts: "project",
  "work-items": "work_item",
  cycles: "cycle",
  modules: "module",
  views: "view",
  pages: "page",
  intake: "intake",
  rfis: "rfi",
  submittals: "submittal",
  "change-events": "change_event",
  commitments: "commitment",
  "prime-contracts": "prime_contract",
};

type LoadState =
  | { phase: "loading"; items: PlaneWorkspaceItem[] }
  | { phase: "ready"; items: PlaneWorkspaceItem[] }
  | { phase: "error"; items: PlaneWorkspaceItem[]; message: string };

export type PlaneSurfaceWorkspaceItem = {
  projectId: number;
  entityType: string;
  entityIdentifier: string;
  name: string;
  href: string;
};

export function getPlaneSurfaceWorkspaceItem(
  projectId: number,
  projectName: string,
  surface: PlaneWorkspaceSurface,
): PlaneSurfaceWorkspaceItem {
  const label = SURFACE_LABELS[surface];
  return {
    projectId,
    entityType: SURFACE_ENTITY_TYPES[surface],
    entityIdentifier: `${projectId}:${surface}`,
    name: surface === "home" ? `${projectName} home` : label,
    href: `/${projectId}/plane/${surface}`,
  };
}

export function sortPlaneSidebarItems(
  items: readonly PlaneWorkspaceItem[],
): PlaneWorkspaceItem[] {
  return [...items].sort((left, right) => {
    if (left.item_kind !== right.item_kind) {
      return left.item_kind === "favorite" ? -1 : 1;
    }
    if (left.item_kind === "favorite") {
      return (
        left.sort_order - right.sort_order ||
        right.created_at.localeCompare(left.created_at) ||
        left.id.localeCompare(right.id)
      );
    }
    return (
      right.last_accessed_at.localeCompare(left.last_accessed_at) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function getPlaneWorkspaceItemsError(cause: unknown): string {
  if (cause instanceof ApiError) {
    if (cause.status === 503) {
      return "Favorites and Recents are unavailable while workspace storage is being enabled.";
    }
    if (cause.status === 401) {
      return "Your session expired. Sign in again to use Favorites and Recents.";
    }
    if (cause.status === 403) {
      return "You do not have permission to use Favorites and Recents for this project.";
    }
  }
  return "Favorites and Recents could not be loaded. Retry to check again.";
}

function PlaneWorkspaceItemsGroup({
  title,
  items,
  icon: Icon,
  collapsed,
  emptyLabel,
  onNavigate,
  onRemoveFavorite,
  pendingItemId,
}: {
  title: "Favorites" | "Recents";
  items: readonly PlaneWorkspaceItem[];
  icon: typeof Star;
  collapsed: boolean;
  emptyLabel: string;
  onNavigate: () => void;
  onRemoveFavorite?: (item: PlaneWorkspaceItem) => void;
  pendingItemId: string | null;
}) {
  return (
    <section aria-label={title} className="mt-4">
      <p
        className={cn(
          "px-2 pb-1.5 text-xs font-semibold text-[#818790]",
          collapsed && "md:hidden",
        )}
      >
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={`${title}: ${item.name}`}
                title={collapsed ? item.name : undefined}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded px-2 pr-8 text-[12px] text-[#4f5660] hover:bg-[#f2f3f4]",
                  collapsed && "md:justify-center md:px-0",
                )}
              >
                <Icon className="size-4 shrink-0 stroke-[1.6]" />
                <span
                  className={cn("min-w-0 truncate", collapsed && "md:hidden")}
                >
                  {item.name}
                </span>
              </Link>
              {onRemoveFavorite ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveFavorite(item)}
                  disabled={pendingItemId !== null}
                  aria-label={`Remove ${item.name} from favorites`}
                  className={cn(
                    "absolute right-1 top-0 grid size-8 place-items-center rounded text-[#818790] opacity-0 hover:bg-[#e5e7eb] hover:text-[#30343a] focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-50",
                    collapsed && "md:hidden",
                  )}
                >
                  <X className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={cn(
            "px-2 py-1 text-[11px] leading-4 text-[#9aa0a8]",
            collapsed && "md:hidden",
          )}
        >
          {emptyLabel}
        </p>
      )}
    </section>
  );
}

export function PlaneWorkspaceItemsNavigation({
  projectId,
  projectName,
  activeSurface,
  collapsed,
  onNavigate,
}: {
  projectId: number;
  projectName: string;
  activeSurface: PlaneWorkspaceSurface;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const [loadState, setLoadState] = useState<LoadState>({
    phase: "loading",
    items: [],
  });
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const loadRequestId = useRef(0);
  const loadedProjectId = useRef<number | null>(null);
  const validProjectId = isValidPlaneWorkspaceProjectId(projectId)
    ? projectId
    : null;
  const currentSurface = useMemo(
    () =>
      validProjectId === null
        ? null
        : getPlaneSurfaceWorkspaceItem(
            validProjectId,
            projectName,
            activeSurface,
          ),
    [activeSurface, projectName, validProjectId],
  );

  const loadItems = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    const projectChanged = loadedProjectId.current !== validProjectId;
    loadedProjectId.current = validProjectId;
    setLoadState((current) => ({
      phase: "loading",
      items: projectChanged ? [] : current.items,
    }));
    setMutationMessage(null);
    if (validProjectId === null) {
      setLoadState({
        phase: "error",
        items: [],
        message: INVALID_PLANE_PROJECT_CONTEXT_MESSAGE,
      });
      return;
    }
    try {
      const items = await listPlaneWorkspaceItems({
        workspaceKey: PLANE_WORKSPACE_KEY,
        projectId: validProjectId,
        limit: 50,
      });
      if (requestId !== loadRequestId.current) return;
      setLoadState({ phase: "ready", items: sortPlaneSidebarItems(items) });
    } catch (cause) {
      if (requestId !== loadRequestId.current) return;
      console.error(
        `[PlaneWorkspaceItemsNavigation] Failed to load project ${validProjectId} Favorites and Recents.`,
        cause,
      );
      setLoadState((current) => ({
        phase: "error",
        items: current.items,
        message: getPlaneWorkspaceItemsError(cause),
      }));
    }
  }, [validProjectId]);

  useEffect(() => {
    void loadItems();
    return () => {
      loadRequestId.current += 1;
    };
  }, [loadItems]);

  const favorites = loadState.items.filter(
    (item) => item.item_kind === "favorite",
  );
  const recents = loadState.items.filter((item) => item.item_kind === "recent");
  const currentFavorite = currentSurface
    ? favorites.find(
        (item) =>
          item.entity_type === currentSurface.entityType &&
          item.entity_identifier === currentSurface.entityIdentifier,
      )
    : undefined;

  async function removeFavorite(item: PlaneWorkspaceItem) {
    setPendingItemId(item.id);
    setMutationMessage(null);
    try {
      await removePlaneWorkspaceItem(item.id);
      setLoadState((current) => ({
        phase: "ready",
        items: current.items.filter((candidate) => candidate.id !== item.id),
      }));
    } catch (cause) {
      console.error(
        `[PlaneWorkspaceItemsNavigation] Failed to remove favorite ${item.id} for project ${projectId}.`,
        cause,
      );
      setMutationMessage(
        getPlaneWorkspaceItemsError(cause).replace(
          "could not be loaded",
          "could not be updated",
        ),
      );
    } finally {
      setPendingItemId(null);
    }
  }

  async function addCurrentFavorite() {
    if (validProjectId === null || currentSurface === null) return;
    setPendingItemId(currentSurface.entityIdentifier);
    setMutationMessage(null);
    try {
      const saved = await savePlaneWorkspaceItem({
        workspaceKey: PLANE_WORKSPACE_KEY,
        projectId: validProjectId,
        itemKind: "favorite",
        entityType: currentSurface.entityType,
        entityIdentifier: currentSurface.entityIdentifier,
        name: currentSurface.name,
        href: currentSurface.href,
      });
      setLoadState((current) => ({
        phase: "ready",
        items: sortPlaneSidebarItems([
          ...current.items.filter((item) => item.id !== saved.id),
          saved,
        ]),
      }));
    } catch (cause) {
      console.error(
        `[PlaneWorkspaceItemsNavigation] Failed to add ${activeSurface} as a favorite for project ${projectId}.`,
        cause,
      );
      setMutationMessage(
        getPlaneWorkspaceItemsError(cause).replace(
          "could not be loaded",
          "could not be updated",
        ),
      );
    } finally {
      setPendingItemId(null);
    }
  }

  if (loadState.phase === "loading" && loadState.items.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          "mt-4 px-2 py-2 text-[11px] text-[#818790]",
          collapsed && "md:hidden",
        )}
      >
        Loading Favorites and Recents…
      </div>
    );
  }

  if (loadState.phase === "error") {
    const canRetry = validProjectId !== null;
    return (
      <div
        role="alert"
        className={cn(
          "mt-4 border-l-2 border-[#d97706] px-2 py-1 text-[11px] leading-4 text-[#6b4f24]",
          collapsed && "md:mx-auto md:w-8 md:border-l-0 md:px-0 md:py-0",
        )}
      >
        <p className={cn(collapsed && "md:sr-only")}>{loadState.message}</p>
        {canRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadItems()}
            title={collapsed ? loadState.message : undefined}
            className="mt-1 inline-flex h-8 items-center gap-1.5 rounded px-1 font-medium text-[#075985] hover:bg-[#f2f3f4] md:mt-0"
          >
            <RotateCw className="size-3.5" />
            <span className={cn(collapsed && "md:sr-only")}>Retry</span>
          </Button>
        ) : (
          <CircleAlert
            className={cn(
              "hidden",
              collapsed && "md:mx-auto md:block md:size-4",
            )}
            aria-hidden="true"
          />
        )}
      </div>
    );
  }

  if (currentSurface === null) return null;

  const mutationPending = pendingItemId !== null;

  return (
    <div>
      <div className="mt-4 flex h-8 items-center justify-between px-2">
        <span
          className={cn(
            "text-xs font-semibold text-[#818790]",
            collapsed && "md:hidden",
          )}
        >
          Favorites
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={mutationPending}
          onClick={() =>
            currentFavorite
              ? void removeFavorite(currentFavorite)
              : void addCurrentFavorite()
          }
          aria-label={
            currentFavorite
              ? `Unfavorite current surface: ${currentSurface.name}`
              : `Favorite current surface: ${currentSurface.name}`
          }
          title={
            currentFavorite
              ? `Remove ${currentSurface.name} from favorites`
              : `Add ${currentSurface.name} to favorites`
          }
          className={cn(
            "grid size-8 place-items-center rounded text-[#818790] hover:bg-[#f2f3f4] hover:text-[#30343a] disabled:cursor-wait disabled:opacity-50",
            collapsed && "md:mx-auto",
          )}
        >
          <Star
            className={cn(
              "size-3.5",
              currentFavorite && "fill-[#f59e0b] text-[#d97706]",
            )}
          />
        </Button>
      </div>
      {favorites.length ? (
        <ul className="space-y-0.5" aria-label="Favorites">
          {favorites.map((item) => (
            <li key={item.id} className="group relative">
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={`Favorites: ${item.name}`}
                title={collapsed ? item.name : undefined}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded px-2 pr-8 text-[12px] text-[#4f5660] hover:bg-[#f2f3f4]",
                  collapsed && "md:justify-center md:px-0",
                )}
              >
                <Star className="size-4 shrink-0 fill-[#f59e0b] text-[#d97706]" />
                <span
                  className={cn("min-w-0 truncate", collapsed && "md:hidden")}
                >
                  {item.name}
                </span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => void removeFavorite(item)}
                disabled={mutationPending}
                aria-label={`Remove ${item.name} from favorites`}
                className={cn(
                  "absolute right-1 top-0 grid size-8 place-items-center rounded text-[#818790] opacity-0 hover:bg-[#e5e7eb] hover:text-[#30343a] focus-visible:opacity-100 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-50",
                  collapsed && "md:hidden",
                )}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={cn(
            "px-2 py-1 text-[11px] leading-4 text-[#9aa0a8]",
            collapsed && "md:hidden",
          )}
        >
          No favorites yet
        </p>
      )}

      <PlaneWorkspaceItemsGroup
        title="Recents"
        items={recents}
        icon={Clock3}
        collapsed={collapsed}
        emptyLabel="No recent items yet"
        onNavigate={onNavigate}
        pendingItemId={pendingItemId}
      />

      {mutationMessage ? (
        <p
          role="alert"
          title={collapsed ? mutationMessage : undefined}
          className={cn(
            "mt-2 px-2 text-[11px] leading-4 text-[#b42318]",
            collapsed && "md:px-0 md:text-center",
          )}
        >
          <CircleAlert
            className={cn(
              "hidden",
              collapsed && "md:mx-auto md:block md:size-4",
            )}
            aria-hidden="true"
          />
          <span className={cn(collapsed && "md:sr-only")}>
            {mutationMessage}
          </span>
        </p>
      ) : null}
    </div>
  );
}
