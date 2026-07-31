/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from "vitest";

import {
  buildPlaneIntakeRequestPolicy,
  resolvePlaneIntakeMutationPolicy,
  resolvePlaneIntakeAccess,
} from "@/features/plane-intake/intake-access";

describe("Plane intake authorization contract", () => {
  it("keeps project members on member-safe tasks without Outlook requests", () => {
    const access = resolvePlaneIntakeAccess(false);
    expect(access).toEqual({
      canAccessOutlookIntake: false,
      taskScope: "mine",
    });
    expect(buildPlaneIntakeRequestPolicy("31", access)).toEqual({
      tasksUrl: "/api/tasks?project_id=31&scope=mine",
      outlookQueriesEnabled: false,
    });
  });

  it("enables all project tasks and Outlook intake for strict app admins", () => {
    const access = resolvePlaneIntakeAccess(true);
    expect(access).toEqual({
      canAccessOutlookIntake: true,
      taskScope: "all",
    });
    expect(buildPlaneIntakeRequestPolicy("31", access)).toEqual({
      tasksUrl: "/api/tasks?project_id=31&scope=all",
      outlookQueriesEnabled: true,
    });
  });

  it("keeps mutation branches source-specific and disabled while saving", () => {
    const member = resolvePlaneIntakeAccess(false);
    const admin = resolvePlaneIntakeAccess(true);

    expect(resolvePlaneIntakeMutationPolicy("task", member, false)).toEqual({
      canPatchTask: true,
      canDeleteTask: true,
      canToggleOutlook: false,
    });
    expect(resolvePlaneIntakeMutationPolicy("outlook", member, false)).toEqual({
      canPatchTask: false,
      canDeleteTask: false,
      canToggleOutlook: false,
    });
    expect(resolvePlaneIntakeMutationPolicy("outlook", admin, false)).toEqual({
      canPatchTask: false,
      canDeleteTask: false,
      canToggleOutlook: true,
    });
    expect(resolvePlaneIntakeMutationPolicy("task", admin, true)).toEqual({
      canPatchTask: false,
      canDeleteTask: false,
      canToggleOutlook: false,
    });
  });
});
