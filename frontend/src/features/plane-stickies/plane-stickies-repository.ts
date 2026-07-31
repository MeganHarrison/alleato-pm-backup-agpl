/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Supabase adapter for the Plane v1.3.1 sticky contract. The relation is
 * intentionally absent from generated types until the deferred migration is
 * approved and applied, so every returned row is validated here.
 */

import {
  PlaneStickySchema,
  type PlaneSticky,
  type PlaneStickyColor,
  type PlaneStickyScope,
} from "./plane-stickies-contract";

export type PlaneStickiesQueryError = { message: string; code?: string };
type QueryResult<T> = { data: T | null; error: PlaneStickiesQueryError | null };

interface StickiesQuery<T = unknown> extends PromiseLike<QueryResult<T>> {
  select(columns?: string): StickiesQuery<T>;
  eq(column: string, value: unknown): StickiesQuery<T>;
  is(column: string, value: null): StickiesQuery<T>;
  not(column: string, operator: string, value: null): StickiesQuery<T>;
  order(column: string, options?: { ascending?: boolean }): StickiesQuery<T>;
  limit(count: number): StickiesQuery<T>;
  insert(value: Record<string, unknown>): StickiesQuery<T>;
  update(value: Record<string, unknown>): StickiesQuery<T>;
  delete(): StickiesQuery<T>;
  single(): Promise<QueryResult<T>>;
  maybeSingle(): Promise<QueryResult<T>>;
}

interface StickiesClient {
  from(relation: string): StickiesQuery;
}

const RELATION = "plane_stickies";

function table(client: unknown): StickiesQuery {
  const typed = client as StickiesClient;
  if (typeof typed?.from !== "function") {
    throw new Error("Plane Stickies requires a Supabase-compatible client.");
  }
  return typed.from(RELATION);
}

function parseSticky(value: unknown): PlaneSticky {
  return PlaneStickySchema.parse(value);
}

function parseStickies(value: unknown): PlaneSticky[] {
  return PlaneStickySchema.array().parse(value);
}

export type PlaneStickyInsert = {
  owner_id: string;
  workspace_key: string;
  scope: PlaneStickyScope;
  project_id: number | null;
  content: string;
  background_color: PlaneStickyColor;
  sort_order: number;
};

export type PlaneStickyChanges = Partial<
  Pick<
    PlaneSticky,
    "content" | "background_color" | "sort_order" | "is_pinned"
  > & { archived_at: string | null }
>;

export function createPlaneStickiesRepository(client: unknown) {
  return {
    async list(input: {
      ownerId: string;
      workspaceKey: string;
      scope: PlaneStickyScope;
      projectId?: number;
      archived: boolean;
      limit: number;
    }): Promise<QueryResult<PlaneSticky[]>> {
      let query = table(client)
        .select("*")
        .eq("owner_id", input.ownerId)
        .eq("workspace_key", input.workspaceKey)
        .eq("scope", input.scope);

      query =
        typeof input.projectId === "number"
          ? query.eq("project_id", input.projectId)
          : query.is("project_id", null);
      query = input.archived
        ? query.not("archived_at", "is", null)
        : query.is("archived_at", null);

      const result = await query
        .order("is_pinned", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .limit(input.limit);

      return {
        data: result.data === null ? null : parseStickies(result.data),
        error: result.error,
      };
    },

    async create(input: PlaneStickyInsert): Promise<QueryResult<PlaneSticky>> {
      const result = await table(client).insert(input).select("*").single();
      return {
        data: result.data === null ? null : parseSticky(result.data),
        error: result.error,
      };
    },

    async findOwnedById(
      id: string,
      ownerId: string,
    ): Promise<QueryResult<PlaneSticky>> {
      const result = await table(client)
        .select("*")
        .eq("id", id)
        .eq("owner_id", ownerId)
        .maybeSingle();
      return {
        data: result.data === null ? null : parseSticky(result.data),
        error: result.error,
      };
    },

    async updateOwned(
      id: string,
      ownerId: string,
      changes: PlaneStickyChanges,
    ): Promise<QueryResult<PlaneSticky>> {
      const result = await table(client)
        .update(changes)
        .eq("id", id)
        .eq("owner_id", ownerId)
        .select("*")
        .single();
      return {
        data: result.data === null ? null : parseSticky(result.data),
        error: result.error,
      };
    },

    async deleteOwned(id: string, ownerId: string): Promise<QueryResult<null>> {
      const result = await table(client)
        .delete()
        .eq("id", id)
        .eq("owner_id", ownerId);
      return { data: null, error: result.error };
    },
  };
}
