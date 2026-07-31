/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Feature-owned dispatcher for Plane-derived Alleato project surfaces.
 */

import { notFound } from "next/navigation";

import { PlaneCyclesPage } from "@/features/plane-cycles";
import { PlaneIntakeSurface } from "@/features/plane-intake";
import { PlaneModulesPage } from "@/features/plane-modules";
import { PlanePagesWorkspace } from "@/features/plane-pages";
import { PlaneProjectViewsIndex } from "@/features/plane-views";
import { PlaneWorkItemsPage } from "./plane-work-items-page";
import { PlaneWorkspaceShell } from "./plane-workspace-shell";
import {
  isPlaneScheduleAdapterMutationPreviewEnabled,
  isPlaneSurface,
  parsePlaneProjectId,
  shouldWrapPlaneSurfaceInDispatcherShell,
  type PlaneSurface,
} from "./plane-surface-access";

export type PlaneSurfaceDispatcherProps = {
  projectId: string;
  projectName: string;
  planeSurface: string;
};

export function PlaneSurfaceDispatcher({
  projectId,
  projectName,
  planeSurface,
}: PlaneSurfaceDispatcherProps) {
  const numericProjectId = parsePlaneProjectId(projectId);

  if (numericProjectId === null || !isPlaneSurface(planeSurface)) {
    notFound();
  }

  if (!shouldWrapPlaneSurfaceInDispatcherShell(planeSurface)) {
    return (
      <PlaneWorkItemsPage
        projectId={String(numericProjectId)}
        projectName={projectName}
      />
    );
  }

  let surfaceContent;
  switch (planeSurface) {
    case "cycles":
      surfaceContent = (
        <PlaneCyclesPage
          projectId={String(numericProjectId)}
          allowMutations={isPlaneScheduleAdapterMutationPreviewEnabled()}
        />
      );
      break;
    case "modules":
      surfaceContent = (
        <PlaneModulesPage
          projectId={numericProjectId}
          allowMutations={isPlaneScheduleAdapterMutationPreviewEnabled()}
        />
      );
      break;
    case "pages":
      surfaceContent = <PlanePagesWorkspace projectId={numericProjectId} />;
      break;
    case "intake":
      surfaceContent = (
        <PlaneIntakeSurface projectId={String(numericProjectId)} />
      );
      break;
    case "views":
      surfaceContent = (
        <PlaneProjectViewsIndex
          projectId={String(numericProjectId)}
          taskRoute={`/${numericProjectId}/plane/work-items`}
        />
      );
      break;
    case "work-items":
      notFound();
  }

  return (
    <PlaneWorkspaceShell
      projectId={String(numericProjectId)}
      projectName={projectName}
      activeSurface={planeSurface}
    >
      {surfaceContent}
    </PlaneWorkspaceShell>
  );
}
