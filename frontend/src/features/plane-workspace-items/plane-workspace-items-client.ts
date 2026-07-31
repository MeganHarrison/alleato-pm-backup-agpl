/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane v1.3.1 UserFavoriteService.
 */

import {
  PlaneWorkspaceItemSchema,
  type PlaneWorkspaceItem,
  type PlaneWorkspaceItemKind,
} from "./plane-workspace-items-contract";
import { apiFetch } from "@/lib/api-client";

export async function listPlaneWorkspaceItems(input: {
  workspaceKey: string;
  projectId?: number;
  itemKind?: PlaneWorkspaceItemKind;
  limit?: number;
}): Promise<PlaneWorkspaceItem[]> {
  const params = new URLSearchParams({
    workspace_key: input.workspaceKey,
  });
  if (input.projectId) params.set("project_id", String(input.projectId));
  if (input.itemKind) params.set("item_kind", input.itemKind);
  if (input.limit) params.set("limit", String(input.limit));

  const body = await apiFetch<{ items: unknown }>(
    `/api/plane-workspace-items?${params}`,
    {
      cache: "no-store",
    },
  );
  return PlaneWorkspaceItemSchema.array().parse(body.items);
}

export async function savePlaneWorkspaceItem(input: {
  workspaceKey: string;
  projectId?: number | null;
  itemKind: PlaneWorkspaceItemKind;
  entityType: string;
  entityIdentifier: string;
  name: string;
  href: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}): Promise<PlaneWorkspaceItem> {
  const body = await apiFetch<{ item: unknown }>("/api/plane-workspace-items", {
    method: "POST",
    body: JSON.stringify({
      workspace_key: input.workspaceKey,
      project_id: input.projectId ?? null,
      item_kind: input.itemKind,
      entity_type: input.entityType,
      entity_identifier: input.entityIdentifier,
      name: input.name,
      href: input.href,
      sort_order: input.sortOrder ?? 65535,
      metadata: input.metadata ?? {},
    }),
  });
  return PlaneWorkspaceItemSchema.parse(body.item);
}

export async function updatePlaneWorkspaceItem(
  id: string,
  changes: Partial<
    Pick<PlaneWorkspaceItem, "name" | "href" | "sort_order" | "metadata">
  > & { touch?: boolean },
): Promise<PlaneWorkspaceItem> {
  const body = await apiFetch<{ item: unknown }>("/api/plane-workspace-items", {
    method: "PATCH",
    body: JSON.stringify({ id, ...changes }),
  });
  return PlaneWorkspaceItemSchema.parse(body.item);
}

export async function removePlaneWorkspaceItem(id: string): Promise<void> {
  await apiFetch<null>("/api/plane-workspace-items", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}
