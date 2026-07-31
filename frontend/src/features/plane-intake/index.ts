/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export {
  PlaneIntakeClient,
  PlaneIntakeLayout,
  PlaneIntakeStatusTabs,
} from "./plane-intake-client";
export {
  buildPlaneIntakeRequestPolicy,
  resolvePlaneIntakeMutationPolicy,
  resolvePlaneIntakeAccess,
  type PlaneIntakeAccess,
} from "./intake-access";
export {
  PlaneIntakeSurface,
  type PlaneIntakeSurfaceProps,
} from "./plane-intake-surface";
export {
  intakeItemMatches,
  mergeIntakeItems,
  normalizeOutlookIntake,
  normalizeTaskIntake,
  resolveAdjacentIntakeKey,
} from "./intake-adapter";
export {
  PLANE_INTAKE_SOURCE_FILES,
  PLANE_INTAKE_SOURCE_REVISION,
} from "./plane-intake-source";
export type {
  EmailIntakeItem,
  IntakeItem,
  IntakeSource,
  IntakeTab,
  OutlookIntakeEmail,
  TaskIntakeItem,
} from "./intake-adapter";
