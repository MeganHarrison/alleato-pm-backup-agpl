/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane v1.3.1:
 * - packages/types/src/favorite/favorite.ts
 * - packages/services/src/user/favorite.service.ts
 * - apps/api/plane/db/models/favorite.py
 */

import { z } from "zod";

export const PLANE_WORKSPACE_ITEM_KINDS = ["favorite", "recent"] as const;
export type PlaneWorkspaceItemKind =
  (typeof PLANE_WORKSPACE_ITEM_KINDS)[number];

const WorkspaceKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

const EntityTypeSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_-]{0,63}$/);

const RelativeHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (href) =>
      href.startsWith("/") &&
      !href.startsWith("//") &&
      !/[\\\u0000-\u001f\u007f]/.test(href) &&
      new URL(href, "https://alleato.invalid").origin ===
        "https://alleato.invalid",
    {
      message: "href must be a normalized application-relative path.",
    },
  );

const MetadataSchema = z.record(z.string(), z.unknown()).default({});

export const PlaneWorkspaceItemSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  workspace_key: WorkspaceKeySchema,
  project_id: z.number().int().positive().nullable(),
  item_kind: z.enum(PLANE_WORKSPACE_ITEM_KINDS),
  entity_type: EntityTypeSchema,
  entity_identifier: z.string().trim().min(1).max(255),
  name: z.string().trim().min(1).max(255),
  href: RelativeHrefSchema,
  sort_order: z.number().finite(),
  metadata: MetadataSchema,
  last_accessed_at: z.string().datetime({ offset: true }),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type PlaneWorkspaceItem = z.infer<typeof PlaneWorkspaceItemSchema>;

export const ListPlaneWorkspaceItemsQuerySchema = z.object({
  workspace_key: WorkspaceKeySchema,
  project_id: z.coerce.number().int().positive().optional(),
  item_kind: z.enum(PLANE_WORKSPACE_ITEM_KINDS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const UpsertPlaneWorkspaceItemSchema = z
  .object({
    workspace_key: WorkspaceKeySchema,
    project_id: z.number().int().positive().nullable().default(null),
    item_kind: z.enum(PLANE_WORKSPACE_ITEM_KINDS),
    entity_type: EntityTypeSchema,
    entity_identifier: z.string().trim().min(1).max(255),
    name: z.string().trim().min(1).max(255),
    href: RelativeHrefSchema,
    sort_order: z.number().finite().default(65535),
    metadata: MetadataSchema,
  })
  .strict();

export const UpdatePlaneWorkspaceItemSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(255).optional(),
    href: RelativeHrefSchema.optional(),
    sort_order: z.number().finite().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    touch: z.boolean().optional(),
  })
  .strict()
  .refine(
    ({ id: _id, ...changes }) => Object.keys(changes).length > 0,
    "At least one workspace item field must be updated.",
  );

export const DeletePlaneWorkspaceItemSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

const PROJECT_SCOPED_ENTITY_TYPES = new Set([
  "project",
  "work_item",
  "cycle",
  "module",
  "view",
  "page",
  "intake",
  "submittal",
  "rfi",
  "change_event",
  "commitment",
  "prime_contract",
]);

export function requiresPlaneWorkspaceProject(entityType: string): boolean {
  return PROJECT_SCOPED_ENTITY_TYPES.has(entityType);
}
