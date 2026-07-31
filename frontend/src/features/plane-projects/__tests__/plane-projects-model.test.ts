/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

import {
  filterAndSortProjects,
  getProjectHref,
  getProjectIdentifier,
  getProjectInitials,
  getProjectName,
} from "../plane-projects-model";
import type { Project } from "@/hooks/use-projects";

function project(overrides: Partial<Project>): Project {
  return {
    id: 1,
    name: "Alpha Build",
    project_number: "A-101",
    company_id: null,
    phase: "Construction",
    state: "Indiana",
    address: "100 Main Street",
    budget: null,
    budget_used: null,
    health_status: null,
    health_score: null,
    completion_percentage: null,
    project_manager: null,
    created_at: "2026-01-01T00:00:00.000Z",
    archived: false,
    ...overrides,
  };
}

describe("Plane Projects model", () => {
  it("filters by membership-returned project fields and active state", () => {
    const projects = [
      project({ id: 1, name: "Alpha Build" }),
      project({ id: 2, name: "Bravo Center", archived: true }),
      project({ id: 3, name: "Hotel", state: "Ohio" }),
    ];

    expect(
      filterAndSortProjects(projects, {
        query: "ohio",
        status: "active",
        sort: "name",
      }).map(({ id }) => id),
    ).toEqual([3]);
  });

  it("shows archived projects only when requested", () => {
    const projects = [
      project({ id: 1, archived: false }),
      project({ id: 2, archived: true }),
    ];

    expect(
      filterAndSortProjects(projects, {
        query: "",
        status: "archived",
        sort: "name",
      }).map(({ id }) => id),
    ).toEqual([2]);
  });

  it("sorts newest and oldest deterministically", () => {
    const projects = [
      project({ id: 1, created_at: "2026-01-01T00:00:00.000Z" }),
      project({ id: 2, created_at: "2026-03-01T00:00:00.000Z" }),
    ];

    expect(
      filterAndSortProjects(projects, {
        query: "",
        status: "all",
        sort: "newest",
      }).map(({ id }) => id),
    ).toEqual([2, 1]);
    expect(
      filterAndSortProjects(projects, {
        query: "",
        status: "all",
        sort: "oldest",
      }).map(({ id }) => id),
    ).toEqual([1, 2]);
  });

  it("provides safe display and navigation fallbacks", () => {
    const untitled = project({
      id: 42,
      name: " ",
      project_number: null,
    });

    expect(getProjectName(untitled)).toBe("Untitled project");
    expect(getProjectIdentifier(untitled)).toBe("42");
    expect(getProjectInitials(untitled)).toBe("UP");
    expect(getProjectHref(untitled)).toBe("/42/home");
  });
});
