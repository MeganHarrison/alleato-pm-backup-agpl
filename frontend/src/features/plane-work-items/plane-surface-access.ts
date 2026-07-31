/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export const SUPPORTED_PLANE_SURFACES = [
  "home",
  "projects",
  "your-work",
  "drafts",
  "stickies",
  "work-items",
  "cycles",
  "modules",
  "views",
  "pages",
  "intake",
  "rfis",
  "submittals",
  "change-events",
  "commitments",
  "prime-contracts",
] as const;

export type PlaneSurface = (typeof SUPPORTED_PLANE_SURFACES)[number];
export type PlaneSurfaceScope = "project" | "workspace";

const WORKSPACE_SCOPED_PLANE_SURFACES = [
  "projects",
  "your-work",
  "drafts",
  "stickies",
] as const satisfies readonly PlaneSurface[];

type PlaneScheduleMutationPreviewEnvironment = Readonly<
  Record<string, string | undefined>
>;

export function parsePlaneProjectId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const projectId = Number(value);
  return Number.isSafeInteger(projectId) ? projectId : null;
}

export function isPlaneSurface(value: string): value is PlaneSurface {
  return SUPPORTED_PLANE_SURFACES.some((surface) => surface === value);
}

export function getPlaneSurfaceScope(surface: PlaneSurface): PlaneSurfaceScope {
  return WORKSPACE_SCOPED_PLANE_SURFACES.some(
    (workspaceSurface) => workspaceSurface === surface,
  )
    ? "workspace"
    : "project";
}

export function isPlaneScheduleAdapterMutationPreviewEnabled(
  environment: PlaneScheduleMutationPreviewEnvironment = process.env,
): boolean {
  return environment.PLANE_SCHEDULE_ADAPTER_MUTATION_PREVIEW === "true";
}

export function shouldWrapPlaneSurfaceInDispatcherShell(
  surface: string,
): boolean {
  return surface !== "work-items";
}
