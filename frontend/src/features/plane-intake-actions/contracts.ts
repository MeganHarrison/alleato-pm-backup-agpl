/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Adapted from Plane's inbox issue action store at revision
 * 39856932cd6b9bd17eab0920506d628190b47af2.
 */

import { z } from "zod";
import type { Json } from "@/types/database.types";

export const PLANE_INTAKE_ACTIONS = [
  "accept",
  "decline",
  "snooze",
  "unsnooze",
  "duplicate",
] as const;

export type PlaneIntakeAction = (typeof PLANE_INTAKE_ACTIONS)[number];
export type PlaneIntakeSource = "task" | "outlook";
export type PlaneIntakeDecision =
  | "pending"
  | "accepted"
  | "declined"
  | "duplicate";

const BaseActionSchema = z.object({
  source: z.enum(["task", "outlook"]),
  sourceId: z.string().min(1).max(200),
  projectId: z.coerce.number().int().positive(),
});

const ActionRequestSchema = z.discriminatedUnion("action", [
  BaseActionSchema.extend({
    action: z.literal("accept"),
  }).strict(),
  BaseActionSchema.extend({
    action: z.literal("decline"),
  }).strict(),
  BaseActionSchema.extend({
    action: z.literal("snooze"),
    snoozeUntil: z.string().datetime({ offset: true }),
  })
    .strict()
    .superRefine((value, context) => {
      if (new Date(value.snoozeUntil).getTime() <= Date.now()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["snoozeUntil"],
          message: "Snooze date must be in the future.",
        });
      }
    }),
  BaseActionSchema.extend({
    action: z.literal("unsnooze"),
  }).strict(),
  BaseActionSchema.extend({
    action: z.literal("duplicate"),
    duplicateTaskId: z.string().uuid(),
  })
    .strict()
    .superRefine((value, context) => {
      if (value.source === "task" && value.sourceId === value.duplicateTaskId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["duplicateTaskId"],
          message: "An intake task cannot be marked as a duplicate of itself.",
        });
      }
    }),
]);

export const PlaneIntakeActionRequestSchema = ActionRequestSchema.superRefine(
  (value, context) => {
    if (value.source === "task" && !z.string().uuid().safeParse(value.sourceId).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceId"],
        message: "Task source ID must be a UUID.",
      });
    }

    if (value.source === "outlook") {
      const numericId = Number(value.sourceId);
      if (!/^[1-9]\d*$/.test(value.sourceId) || !Number.isSafeInteger(numericId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourceId"],
          message: "Outlook Intake source ID must be a positive integer.",
        });
      }
    }
  },
);

export type PlaneIntakeActionRequest = z.infer<
  typeof PlaneIntakeActionRequestSchema
>;

export interface PlaneIntakeState {
  decision: PlaneIntakeDecision;
  snoozed_till: string | null;
  duplicate_task_id: string | null;
  accepted_task_id: string | null;
  resolved_at: string | null;
  updated_at: string;
  updated_by: string;
}

export interface PlaneIntakeActionResponse {
  source: PlaneIntakeSource;
  sourceId: string;
  projectId: number;
  action: PlaneIntakeAction;
  state: PlaneIntakeState;
  taskId: string | null;
  idempotent: boolean;
}

type JsonRecord = { [key: string]: Json | undefined };

export function asJsonRecord(value: Json | null | undefined): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};
}

export function buildPlaneIntakeState(
  request: PlaneIntakeActionRequest,
  actorId: string,
  now: string,
  acceptedTaskId: string | null = null,
): PlaneIntakeState {
  switch (request.action) {
    case "accept":
      return {
        decision: "accepted",
        snoozed_till: null,
        duplicate_task_id: null,
        accepted_task_id: acceptedTaskId,
        resolved_at: now,
        updated_at: now,
        updated_by: actorId,
      };
    case "decline":
      return {
        decision: "declined",
        snoozed_till: null,
        duplicate_task_id: null,
        accepted_task_id: null,
        resolved_at: now,
        updated_at: now,
        updated_by: actorId,
      };
    case "duplicate":
      return {
        decision: "duplicate",
        snoozed_till: null,
        duplicate_task_id: request.duplicateTaskId,
        accepted_task_id: null,
        resolved_at: now,
        updated_at: now,
        updated_by: actorId,
      };
    case "snooze":
      return {
        decision: "pending",
        snoozed_till: request.snoozeUntil,
        duplicate_task_id: null,
        accepted_task_id: null,
        resolved_at: null,
        updated_at: now,
        updated_by: actorId,
      };
    case "unsnooze":
      return {
        decision: "pending",
        snoozed_till: null,
        duplicate_task_id: null,
        accepted_task_id: null,
        resolved_at: null,
        updated_at: now,
        updated_by: actorId,
      };
  }
}

export function mergePlaneIntakeMetadata(
  metadata: Json | null | undefined,
  state: PlaneIntakeState,
): JsonRecord {
  return {
    ...asJsonRecord(metadata),
    plane_intake: { ...state },
  };
}

export function isProjectScopedTask(
  projectId: number,
  task: { project_id: number | null; project_ids: number[] | null },
): boolean {
  return (
    task.project_id === projectId ||
    (task.project_ids ?? []).includes(projectId)
  );
}

export function outlookSourceKey(intakeId: number): string {
  return `outlook-intake:${intakeId}`;
}

export function actionSuccessMessage(action: PlaneIntakeAction): string {
  switch (action) {
    case "accept":
      return "Added to project";
    case "decline":
      return "Intake item declined";
    case "snooze":
      return "Intake item snoozed";
    case "unsnooze":
      return "Intake item returned to review";
    case "duplicate":
      return "Duplicate resolved";
  }
}
