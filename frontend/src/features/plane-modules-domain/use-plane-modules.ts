/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlaneModules,
  patchPlaneModule,
  postPlaneModule,
  putPlaneModuleTasks,
} from "./plane-modules-api";

export const planeModuleKeys = {
  all: ["plane-modules"] as const,
  project: (projectId: number) =>
    [...planeModuleKeys.all, "project", projectId] as const,
};

export function usePlaneModules(projectId: number) {
  return useQuery({
    queryKey: planeModuleKeys.project(projectId),
    queryFn: () => fetchPlaneModules(projectId),
    enabled: Number.isInteger(projectId) && projectId > 0,
    staleTime: 30_000,
  });
}

export function useCreatePlaneModule(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postPlaneModule,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: planeModuleKeys.project(projectId),
      }),
  });
}

export function useUpdatePlaneModule(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchPlaneModule,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: planeModuleKeys.project(projectId),
      }),
  });
}

export function useReplacePlaneModuleTasks(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: putPlaneModuleTasks,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: planeModuleKeys.project(projectId),
      }),
  });
}
