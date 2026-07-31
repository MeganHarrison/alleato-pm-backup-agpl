/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

import { apiFetch } from "@/lib/api-client";
import type {
  CreatePlaneModuleInput,
  PlaneModule,
  ReplacePlaneModuleTasksInput,
  UpdatePlaneModuleInput,
} from "./plane-modules-contract";

interface PlaneModulesResponse<T> {
  data: T;
}

export async function fetchPlaneModules(
  projectId: number,
): Promise<PlaneModule[]> {
  const response = await apiFetch<PlaneModulesResponse<PlaneModule[]>>(
    `/api/plane-modules?projectId=${projectId}`,
  );
  return response.data;
}

export async function postPlaneModule(
  input: CreatePlaneModuleInput,
): Promise<PlaneModule> {
  const response = await apiFetch<PlaneModulesResponse<PlaneModule>>(
    "/api/plane-modules",
    { method: "POST", body: JSON.stringify(input) },
  );
  return response.data;
}

export async function patchPlaneModule(
  input: UpdatePlaneModuleInput,
): Promise<PlaneModule> {
  const response = await apiFetch<PlaneModulesResponse<PlaneModule>>(
    "/api/plane-modules",
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return response.data;
}

export async function putPlaneModuleTasks(
  input: ReplacePlaneModuleTasksInput,
): Promise<string[]> {
  const response = await apiFetch<PlaneModulesResponse<{ taskIds: string[] }>>(
    "/api/plane-modules/tasks",
    { method: "PUT", body: JSON.stringify(input) },
  );
  return response.data.taskIds;
}
