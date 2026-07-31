import {
  DEFAULT_PROJECT_PHASE_FILTER,
  filterPortfolioProjects,
} from "./projects-page-filters";
import type { Project } from "@/types/portfolio";

function project(overrides: Partial<Project>): Project {
  return {
    id: "1",
    name: "Westfield",
    projectNumber: "24-115",
    jobNumber: "24-115",
    client: "Alleato",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    status: "Active",
    stage: "Complete",
    type: "General",
    notes: "",
    isFlagged: false,
    ...overrides,
  };
}

describe("projects page filters", () => {
  it("defaults the projects page to current-phase projects", () => {
    const projects = [
      project({ id: "1", phase: "Complete" }),
      project({ id: "2", phase: "Current" }),
      project({ id: "3", phase: "Planning" }),
    ];

    expect(
      filterPortfolioProjects(projects, {
        phaseFilter: DEFAULT_PROJECT_PHASE_FILTER,
        categoryFilter: null,
        clientFilter: null,
      }).map((item) => item.id),
    ).toEqual(["2"]);
  });

  it("still applies an explicit phase filter case-insensitively", () => {
    const projects = [
      project({ id: "1", phase: "complete" }),
      project({ id: "2", phase: "Planning" }),
    ];

    expect(
      filterPortfolioProjects(projects, {
        phaseFilter: "Complete",
        categoryFilter: null,
        clientFilter: null,
      }).map((item) => item.id),
    ).toEqual(["1"]);
  });
});
