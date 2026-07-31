/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane v1.3.1 packages/types/src/stickies.ts at
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

import { z } from "zod";

export const PLANE_STICKY_COLORS = [
  "gray",
  "peach",
  "pink",
  "orange",
  "green",
  "light-blue",
  "dark-blue",
  "purple",
] as const;

export const PLANE_STICKY_SCOPES = [
  "personal",
  "workspace",
  "project",
] as const;

export type PlaneStickyColor = (typeof PLANE_STICKY_COLORS)[number];
export type PlaneStickyScope = (typeof PLANE_STICKY_SCOPES)[number];

const WorkspaceKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

const ProjectIdSchema = z.number().int().positive();

export const PlaneStickySchema = z.object({
  id: z.string().uuid(),
  owner_id: z.string().uuid(),
  workspace_key: WorkspaceKeySchema,
  scope: z.enum(PLANE_STICKY_SCOPES),
  project_id: ProjectIdSchema.nullable(),
  content: z.string().max(10_000),
  background_color: z.enum(PLANE_STICKY_COLORS),
  sort_order: z.number().finite(),
  is_pinned: z.boolean(),
  archived_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type PlaneSticky = z.infer<typeof PlaneStickySchema>;

function scopeMatchesProject({
  scope,
  project_id,
}: {
  scope: PlaneStickyScope;
  project_id: number | null | undefined;
}): boolean {
  return scope === "project"
    ? typeof project_id === "number"
    : project_id == null;
}

export const ListPlaneStickiesQuerySchema = z
  .object({
    workspace_key: WorkspaceKeySchema,
    scope: z.enum(PLANE_STICKY_SCOPES).default("workspace"),
    project_id: z.coerce.number().int().positive().optional(),
    archived: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    limit: z.coerce.number().int().min(1).max(100).default(100),
  })
  .refine(scopeMatchesProject, {
    message: "Project scope requires project_id; other scopes forbid it.",
    path: ["project_id"],
  });

export const CreatePlaneStickyRequestSchema = z
  .object({
    workspace_key: WorkspaceKeySchema,
    scope: z.enum(PLANE_STICKY_SCOPES).default("workspace"),
    project_id: ProjectIdSchema.nullable().default(null),
    content: z.string().max(10_000).default(""),
    background_color: z.enum(PLANE_STICKY_COLORS).default("gray"),
    sort_order: z.number().finite().default(65_535),
  })
  .strict()
  .refine(scopeMatchesProject, {
    message: "Project scope requires project_id; other scopes forbid it.",
    path: ["project_id"],
  });

export const UpdatePlaneStickySchema = z
  .object({
    id: z.string().uuid(),
    content: z.string().max(10_000).optional(),
    background_color: z.enum(PLANE_STICKY_COLORS).optional(),
    sort_order: z.number().finite().optional(),
    is_pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine(
    ({ id: _id, ...changes }) => Object.keys(changes).length > 0,
    "At least one sticky field must be updated.",
  );

export const DeletePlaneStickySchema = z
  .object({ id: z.string().uuid() })
  .strict();

export type CreatePlaneStickyInput = z.input<
  typeof CreatePlaneStickyRequestSchema
>;
export type UpdatePlaneStickyInput = z.infer<typeof UpdatePlaneStickySchema>;

export function isPlaneStickyMigrationMissing(
  error: {
    code?: string;
    message?: string;
  } | null,
): boolean {
  if (!error) return false;
  const serialized = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return (
    serialized.includes("42p01") ||
    serialized.includes("pgrst205") ||
    serialized.includes("schema cache") ||
    serialized.includes('relation "plane_stickies" does not exist')
  );
}
