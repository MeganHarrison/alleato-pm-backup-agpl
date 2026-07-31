/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

import { z } from "zod";

export const PLANE_MODULE_STATUSES = [
  "backlog",
  "planned",
  "in-progress",
  "paused",
  "completed",
  "cancelled",
] as const;

export type PlaneModuleStatus = (typeof PLANE_MODULE_STATUSES)[number];

export const PlaneModuleStatusSchema = z.enum(PLANE_MODULE_STATUSES);
export const PlaneModuleProjectIdSchema = z.coerce.number().int().positive();
export const PlaneModuleIdSchema = z.string().uuid();
const nullableDateSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()])
  .optional();

const moduleFields = {
  name: z.string().trim().min(1).max(255),
  description: z.string().max(20_000).default(""),
  status: PlaneModuleStatusSchema.default("planned"),
  leadPersonId: z.string().uuid().nullable().default(null),
  memberPersonIds: z.array(z.string().uuid()).max(250).default([]),
  startDate: nullableDateSchema,
  targetDate: nullableDateSchema,
  sortOrder: z.number().finite().default(65_535),
};

export const CreatePlaneModuleSchema = z
  .object({
    projectId: PlaneModuleProjectIdSchema,
    ...moduleFields,
  })
  .superRefine((value, context) => {
    if (
      value.startDate &&
      value.targetDate &&
      value.startDate > value.targetDate
    ) {
      context.addIssue({
        code: "custom",
        path: ["targetDate"],
        message: "Target date cannot be earlier than start date.",
      });
    }
  });

export const UpdatePlaneModuleSchema = z
  .object({
    moduleId: PlaneModuleIdSchema,
    projectId: PlaneModuleProjectIdSchema,
    name: moduleFields.name.optional(),
    description: z.string().max(20_000).optional(),
    status: PlaneModuleStatusSchema.optional(),
    leadPersonId: z.string().uuid().nullable().optional(),
    memberPersonIds: z.array(z.string().uuid()).max(250).optional(),
    startDate: nullableDateSchema,
    targetDate: nullableDateSchema,
    sortOrder: z.number().finite().optional(),
    archivedAt: z.string().datetime().nullable().optional(),
  })
  .refine(
    (value) =>
      [
        value.name,
        value.description,
        value.status,
        value.leadPersonId,
        value.memberPersonIds,
        value.startDate,
        value.targetDate,
        value.sortOrder,
        value.archivedAt,
      ].some((field) => typeof field !== "undefined"),
    "At least one module field is required.",
  );

export const ReplacePlaneModuleTasksSchema = z.object({
  moduleId: PlaneModuleIdSchema,
  projectId: PlaneModuleProjectIdSchema,
  taskIds: z.array(z.string().uuid()).max(2_000),
});

export interface PlaneModule {
  id: string;
  projectId: number;
  name: string;
  description: string;
  status: PlaneModuleStatus;
  leadPersonId: string | null;
  memberPersonIds: string[];
  taskIds: string[];
  startDate: string | null;
  targetDate: string | null;
  sortOrder: number;
  archivedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CreatePlaneModuleInput = z.input<typeof CreatePlaneModuleSchema>;
export type CreatePlaneModule = z.output<typeof CreatePlaneModuleSchema>;
export type UpdatePlaneModuleInput = z.input<typeof UpdatePlaneModuleSchema>;
export type UpdatePlaneModule = z.output<typeof UpdatePlaneModuleSchema>;
export type ReplacePlaneModuleTasksInput = z.input<
  typeof ReplacePlaneModuleTasksSchema
>;
