/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { z } from "zod";

export const PlaneDraftProjectIdSchema = z.coerce.number().int().positive();
export const PlaneDraftIdSchema = z.string().uuid();
export const PlaneDraftVersionSchema = z.number().int().positive();

export const PlaneDraftArtifactSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  project_id: z.number().int().positive(),
  artifact_type: z.enum([
    "owner_update",
    "risk_report",
    "meeting_prep",
    "analysis",
    "briefing",
    "note",
    "change_event_draft",
  ]),
  title: z.string(),
  status: z.literal("draft"),
  version: z.number().int().positive(),
  content: z.record(z.string(), z.unknown()),
  context_snapshot: z.record(z.string(), z.unknown()),
  session_id: z.string().nullable(),
  promoted_to: z.string().nullable(),
  promoted_at: z.string().nullable(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PlaneDraftListResponseSchema = z.object({
  artifacts: z.array(PlaneDraftArtifactSchema),
});

export const CreatePlaneDraftSchema = z.object({
  action: z.literal("create"),
  project_id: PlaneDraftProjectIdSchema,
  title: z.string().trim().min(1).max(200),
  text: z.string().max(100_000),
});

export const CopyPlaneDraftSchema = z.object({
  action: z.literal("copy"),
  project_id: PlaneDraftProjectIdSchema,
  id: PlaneDraftIdSchema,
});

export const PlaneDraftPostSchema = z.discriminatedUnion("action", [
  CreatePlaneDraftSchema,
  CopyPlaneDraftSchema,
]);

export const PlaneDraftPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    project_id: PlaneDraftProjectIdSchema,
    id: PlaneDraftIdSchema,
    version: PlaneDraftVersionSchema,
    title: z.string().trim().min(1).max(200),
    text: z.string().max(100_000),
  }),
  z.object({
    action: z.enum(["finalize", "archive"]),
    project_id: PlaneDraftProjectIdSchema,
    id: PlaneDraftIdSchema,
    version: PlaneDraftVersionSchema,
  }),
]);

export const DeletePlaneDraftSchema = z.object({
  project_id: PlaneDraftProjectIdSchema,
  id: PlaneDraftIdSchema,
});
