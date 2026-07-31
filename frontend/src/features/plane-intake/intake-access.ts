/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export interface PlaneIntakeAccess {
  canAccessOutlookIntake: boolean;
  taskScope: "all" | "mine";
}

export interface PlaneIntakeMutationPolicy {
  canPatchTask: boolean;
  canDeleteTask: boolean;
  canToggleOutlook: boolean;
}

export function resolvePlaneIntakeAccess(
  isStrictAppAdmin: boolean,
): PlaneIntakeAccess {
  return isStrictAppAdmin
    ? {
        canAccessOutlookIntake: true,
        taskScope: "all",
      }
    : {
        canAccessOutlookIntake: false,
        taskScope: "mine",
      };
}

export function buildPlaneIntakeRequestPolicy(
  projectId: string,
  access: PlaneIntakeAccess,
) {
  return {
    tasksUrl: `/api/tasks?project_id=${projectId}&scope=${access.taskScope}`,
    outlookQueriesEnabled: access.canAccessOutlookIntake,
  } as const;
}

export function resolvePlaneIntakeMutationPolicy(
  source: "task" | "outlook" | null,
  access: PlaneIntakeAccess,
  saving: boolean,
): PlaneIntakeMutationPolicy {
  if (saving || source === null) {
    return {
      canPatchTask: false,
      canDeleteTask: false,
      canToggleOutlook: false,
    };
  }

  return {
    canPatchTask: source === "task",
    canDeleteTask: source === "task",
    canToggleOutlook: source === "outlook" && access.canAccessOutlookIntake,
  };
}
