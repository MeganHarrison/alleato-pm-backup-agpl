/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Feature-owned dispatcher for Plane-derived Alleato project surfaces.
 */

import { notFound } from "next/navigation";

import { PlaneChangeEventsSurface } from "@/features/plane-change-events";
import { PlaneCommitmentsPage } from "@/features/plane-commitments";
import { PlaneCyclesPage } from "@/features/plane-cycles";
import { PlaneDraftsPage } from "@/features/plane-drafts";
import { PlaneHomePage } from "@/features/plane-home";
import { PlaneIntakeSurface } from "@/features/plane-intake";
import { PlaneModulesPage } from "@/features/plane-modules";
import { PlanePagesWorkspace } from "@/features/plane-pages";
import { PlanePrimeContractsPage } from "@/features/plane-prime-contracts";
import { PlaneProjectsSurface } from "@/features/plane-projects";
import { PlaneRfisSurface } from "@/features/plane-rfis";
import { PlaneStickiesPage } from "@/features/plane-stickies";
import { PlaneProjectViewsIndex } from "@/features/plane-views";
import { PlaneSubmittalsPage } from "@/features/plane-submittals";
import { PlaneYourWorkSurface } from "@/features/plane-your-work";
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
    case "home":
      surfaceContent = <PlaneHomePage projectId={String(numericProjectId)} />;
      break;
    case "projects":
      surfaceContent = <PlaneProjectsSurface />;
      break;
    case "your-work":
      surfaceContent = <PlaneYourWorkSurface />;
      break;
    case "drafts":
      surfaceContent = <PlaneDraftsPage />;
      break;
    case "stickies":
      surfaceContent = <PlaneStickiesPage projectId={numericProjectId} />;
      break;
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
    case "rfis":
      surfaceContent = <PlaneRfisSurface projectId={numericProjectId} />;
      break;
    case "submittals":
      surfaceContent = (
        <PlaneSubmittalsPage
          projectId={numericProjectId}
          projectName={projectName}
        />
      );
      break;
    case "change-events":
      surfaceContent = (
        <PlaneChangeEventsSurface projectId={numericProjectId} />
      );
      break;
    case "commitments":
      surfaceContent = (
        <PlaneCommitmentsPage
          projectId={String(numericProjectId)}
          projectName={projectName}
        />
      );
      break;
    case "prime-contracts":
      surfaceContent = (
        <PlanePrimeContractsPage
          projectId={numericProjectId}
          projectName={projectName}
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
