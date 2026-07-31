/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The idempotent entity upsert and ordering fields adapt Plane's
 * UserFavorite service/model contract for Alleato's Supabase boundary.
 */

import {
  PlaneWorkspaceItemSchema,
  type PlaneWorkspaceItem,
  type PlaneWorkspaceItemKind,
} from "./plane-workspace-items-contract";

type QueryError = { message: string; code?: string };
type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

interface WorkspaceItemsQuery<T = unknown> extends PromiseLike<QueryResult<T>> {
  select(columns?: string): WorkspaceItemsQuery<T>;
  eq(column: string, value: unknown): WorkspaceItemsQuery<T>;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): WorkspaceItemsQuery<T>;
  limit(count: number): WorkspaceItemsQuery<T>;
  upsert(
    value: Record<string, unknown>,
    options: { onConflict: string },
  ): WorkspaceItemsQuery<T>;
  update(value: Record<string, unknown>): WorkspaceItemsQuery<T>;
  delete(): WorkspaceItemsQuery<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
}

interface WorkspaceItemsClient {
  from(relation: string): WorkspaceItemsQuery;
}

// This relation is introduced by the task-owned deferred migration. It cannot
// appear in generated database.types.ts until that migration is approved and
// applied, so this adapter owns the temporary runtime contract and validates
// every returned row with PlaneWorkspaceItemSchema.
const USER_WORKSPACE_ITEMS_RELATION = "user_workspace_items";

type WorkspaceItemInsert = {
  user_id: string;
  workspace_key: string;
  project_id: number | null;
  item_kind: PlaneWorkspaceItemKind;
  entity_type: string;
  entity_identifier: string;
  name: string;
  href: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  last_accessed_at: string;
};

type WorkspaceItemUpdate = Partial<
  Pick<
    PlaneWorkspaceItem,
    "name" | "href" | "sort_order" | "metadata" | "last_accessed_at"
  >
>;

function getTable(client: unknown): WorkspaceItemsQuery {
  const typedClient = client as WorkspaceItemsClient;
  if (typeof typedClient?.from !== "function") {
    throw new Error(
      "Plane workspace item repository requires a Supabase-compatible client.",
    );
  }
  return typedClient.from(USER_WORKSPACE_ITEMS_RELATION);
}

function parseItem(data: unknown): PlaneWorkspaceItem {
  return PlaneWorkspaceItemSchema.parse(data);
}

function parseItems(data: unknown): PlaneWorkspaceItem[] {
  return PlaneWorkspaceItemSchema.array().parse(data);
}

export function createPlaneWorkspaceItemsRepository(client: unknown) {
  return {
    async list(input: {
      userId: string;
      workspaceKey: string;
      projectId?: number;
      itemKind?: PlaneWorkspaceItemKind;
      limit: number;
    }): Promise<QueryResult<PlaneWorkspaceItem[]>> {
      let query = getTable(client)
        .select("*")
        .eq("user_id", input.userId)
        .eq("workspace_key", input.workspaceKey);

      if (typeof input.projectId === "number") {
        query = query.eq("project_id", input.projectId);
      }
      if (input.itemKind) {
        query = query.eq("item_kind", input.itemKind);
      }

      query =
        input.itemKind === "favorite"
          ? query
              .order("sort_order", { ascending: true })
              .order("created_at", { ascending: false })
              .order("id", { ascending: true })
          : query
              .order("last_accessed_at", { ascending: false })
              .order("id", { ascending: true });

      const result = await query.limit(input.limit);
      return {
        data: result.data === null ? null : parseItems(result.data),
        error: result.error,
      };
    },

    async upsert(
      input: WorkspaceItemInsert,
    ): Promise<QueryResult<PlaneWorkspaceItem>> {
      const result = await getTable(client)
        .upsert(input, {
          onConflict:
            "user_id,workspace_key,item_kind,entity_type,entity_identifier",
        })
        .select("*")
        .single();
      return {
        data: result.data === null ? null : parseItem(result.data),
        error: result.error,
      };
    },

    async findOwnedById(
      id: string,
      userId: string,
    ): Promise<QueryResult<PlaneWorkspaceItem>> {
      const result = await getTable(client)
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      return {
        data: result.data === null ? null : parseItem(result.data),
        error: result.error,
      };
    },

    async updateOwned(
      id: string,
      userId: string,
      changes: WorkspaceItemUpdate,
    ): Promise<QueryResult<PlaneWorkspaceItem>> {
      const result = await getTable(client)
        .update(changes)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();
      return {
        data: result.data === null ? null : parseItem(result.data),
        error: result.error,
      };
    },

    async deleteOwned(id: string, userId: string): Promise<QueryResult<null>> {
      const result = await getTable(client)
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      return {
        data: null,
        error: result.error,
      };
    },
  };
}
