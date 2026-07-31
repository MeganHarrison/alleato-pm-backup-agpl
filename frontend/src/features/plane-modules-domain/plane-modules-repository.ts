/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

import { listRuntimeTableRowsWhereEqual } from "@/lib/supabase/runtime-table";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  CreatePlaneModule,
  PlaneModule,
  PlaneModuleStatus,
  UpdatePlaneModule,
} from "./plane-modules-contract";

interface RepositoryError {
  code?: string;
  message: string;
}

interface RepositoryResult<T> {
  data: T | null;
  error: RepositoryError | null;
}

interface PlaneModulesDb {
  rpc(
    functionName:
      | "plane_create_project_module"
      | "plane_update_project_module"
      | "plane_replace_module_tasks",
    args: Record<string, unknown>,
  ): PromiseLike<RepositoryResult<unknown>>;
}

interface PlaneModuleJoinedRow {
  id: string;
  project_id: number;
  name: string;
  description: string;
  status: PlaneModuleStatus;
  lead_person_id: string | null;
  start_date: string | null;
  target_date: string | null;
  sort_order: number;
  archived_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  project_module_members: Array<{ person_id: string }> | null;
  module_task_memberships: Array<{ task_id: string }> | null;
}

export class PlaneModulesRepositoryError extends Error {
  constructor(
    readonly kind: "conflict" | "not_found" | "validation" | "database",
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "PlaneModulesRepositoryError";
  }
}

function getRpcDb(): PlaneModulesDb {
  return createServiceClient() as unknown as PlaneModulesDb;
}

function throwRepositoryError(error: RepositoryError, fallback: string): never {
  if (error.code === "23505") {
    throw new PlaneModulesRepositoryError(
      "conflict",
      "A module with this name already exists in the project.",
      error.code,
    );
  }
  if (error.code === "23514") {
    throw new PlaneModulesRepositoryError(
      "validation",
      error.message,
      error.code,
    );
  }
  if (error.code === "P0002") {
    throw new PlaneModulesRepositoryError(
      "not_found",
      "The module was not found in this project.",
      error.code,
    );
  }
  throw new PlaneModulesRepositoryError(
    "database",
    `${fallback}: ${error.message}`,
    error.code,
  );
}

function mapModule(row: PlaneModuleJoinedRow): PlaneModule {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    leadPersonId: row.lead_person_id,
    memberPersonIds: (row.project_module_members ?? [])
      .map((member) => member.person_id)
      .sort(),
    taskIds: (row.module_task_memberships ?? [])
      .map((membership) => membership.task_id)
      .sort(),
    startDate: row.start_date,
    targetDate: row.target_date,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const MODULE_SELECT = `
  id,
  project_id,
  name,
  description,
  status,
  lead_person_id,
  start_date,
  target_date,
  sort_order,
  archived_at,
  created_by,
  updated_by,
  created_at,
  updated_at,
  project_module_members(person_id),
  module_task_memberships(task_id)
`;

export async function listPlaneModules(
  projectId: number,
): Promise<PlaneModule[]> {
  const { data, error } = await listRuntimeTableRowsWhereEqual(
    createServiceClient(),
    "project_modules",
    { column: "project_id", value: projectId },
    MODULE_SELECT,
  );

  if (error) throwRepositoryError(error, "Failed to load project modules");
  return ((data ?? []) as unknown as PlaneModuleJoinedRow[])
    .map(mapModule)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        right.createdAt.localeCompare(left.createdAt),
    );
}

export async function getPlaneModule(
  projectId: number,
  moduleId: string,
): Promise<PlaneModule | null> {
  const modules = await listPlaneModules(projectId);
  return modules.find((projectModule) => projectModule.id === moduleId) ?? null;
}

export async function createPlaneModule(
  input: CreatePlaneModule,
  actorId: string,
): Promise<PlaneModule> {
  const { data, error } = await getRpcDb().rpc("plane_create_project_module", {
    p_project_id: input.projectId,
    p_name: input.name,
    p_description: input.description,
    p_status: input.status,
    p_lead_person_id: input.leadPersonId,
    p_start_date: input.startDate ?? null,
    p_target_date: input.targetDate ?? null,
    p_sort_order: input.sortOrder,
    p_member_person_ids: Array.from(new Set(input.memberPersonIds)),
    p_actor_id: actorId,
  });

  if (error) throwRepositoryError(error, "Failed to create project module");
  const createdRow = Array.isArray(data) ? data[0] : data;
  const moduleId =
    createdRow && typeof createdRow === "object" && "id" in createdRow
      ? String((createdRow as { id: unknown }).id)
      : null;
  if (!moduleId) {
    throw new PlaneModulesRepositoryError(
      "database",
      "Created module did not return an ID.",
    );
  }
  const createdModule = await getPlaneModule(input.projectId, moduleId);
  if (!createdModule) {
    throw new PlaneModulesRepositoryError(
      "database",
      "Created module could not be read back.",
    );
  }
  return createdModule;
}

export async function updatePlaneModule(
  current: PlaneModule,
  input: UpdatePlaneModule,
  actorId: string,
): Promise<PlaneModule> {
  const { error } = await getRpcDb().rpc("plane_update_project_module", {
    p_module_id: current.id,
    p_project_id: current.projectId,
    p_name: input.name ?? current.name,
    p_description: input.description ?? current.description,
    p_status: input.status ?? current.status,
    p_lead_person_id:
      typeof input.leadPersonId === "undefined"
        ? current.leadPersonId
        : input.leadPersonId,
    p_start_date:
      typeof input.startDate === "undefined"
        ? current.startDate
        : input.startDate,
    p_target_date:
      typeof input.targetDate === "undefined"
        ? current.targetDate
        : input.targetDate,
    p_sort_order: input.sortOrder ?? current.sortOrder,
    p_archived_at:
      typeof input.archivedAt === "undefined"
        ? current.archivedAt
        : input.archivedAt,
    p_member_person_ids: input.memberPersonIds ?? current.memberPersonIds,
    p_actor_id: actorId,
  });

  if (error) throwRepositoryError(error, "Failed to update project module");
  const updated = await getPlaneModule(current.projectId, current.id);
  if (!updated) {
    throw new PlaneModulesRepositoryError(
      "database",
      "Updated module could not be read back.",
    );
  }
  return updated;
}

export async function replacePlaneModuleTasks({
  moduleId,
  projectId,
  taskIds,
  actorId,
}: {
  moduleId: string;
  projectId: number;
  taskIds: string[];
  actorId: string;
}): Promise<string[]> {
  const { data, error } = await getRpcDb().rpc("plane_replace_module_tasks", {
    p_module_id: moduleId,
    p_project_id: projectId,
    p_task_ids: Array.from(new Set(taskIds)),
    p_actor_id: actorId,
  });

  if (error) throwRepositoryError(error, "Failed to replace module tasks");
  return Array.isArray(data)
    ? data
        .filter((taskId): taskId is string => typeof taskId === "string")
        .sort()
    : [];
}
