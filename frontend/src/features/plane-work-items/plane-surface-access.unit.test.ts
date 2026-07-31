import fs from "node:fs";
import path from "node:path";

import {
  getPlaneSurfaceScope,
  isPlaneScheduleAdapterMutationPreviewEnabled,
  isPlaneSurface,
  parsePlaneProjectId,
  shouldWrapPlaneSurfaceInDispatcherShell,
} from "./plane-surface-access";

describe("Plane schedule adapter mutation preview access", () => {
  it("fails closed when the server-only flag is absent or invalid", () => {
    expect(isPlaneScheduleAdapterMutationPreviewEnabled({})).toBe(false);
    expect(
      isPlaneScheduleAdapterMutationPreviewEnabled({
        PLANE_SCHEDULE_ADAPTER_MUTATION_PREVIEW: "TRUE",
      }),
    ).toBe(false);
  });

  it("enables mutation preview only for the exact server-only flag", () => {
    expect(
      isPlaneScheduleAdapterMutationPreviewEnabled({
        PLANE_SCHEDULE_ADAPTER_MUTATION_PREVIEW: "true",
      }),
    ).toBe(true);
  });

  it("never honors the retired or NEXT_PUBLIC preview flags", () => {
    expect(
      isPlaneScheduleAdapterMutationPreviewEnabled({
        PLANE_SCHEDULE_ADAPTER_PREVIEW: "true",
        NEXT_PUBLIC_PLANE_SCHEDULE_ADAPTER_MUTATION_PREVIEW: "true",
      }),
    ).toBe(false);
  });
});

describe("Plane dispatcher access", () => {
  const dispatcherSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "src",
      "features",
      "plane-work-items",
      "plane-surface-dispatcher.tsx",
    ),
    "utf8",
  );

  it("accepts only positive safe integer project ids", () => {
    expect(parsePlaneProjectId("31")).toBe(31);
    expect(parsePlaneProjectId("0")).toBeNull();
    expect(parsePlaneProjectId("-1")).toBeNull();
    expect(parsePlaneProjectId("31x")).toBeNull();
    expect(parsePlaneProjectId(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
  });

  it("accepts the complete phase-three replacement route matrix", () => {
    expect(
      [
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
      ].every(isPlaneSurface),
    ).toBe(true);
    expect(isPlaneSurface("tasks")).toBe(false);
  });

  it("distinguishes workspace data scopes from project data scopes", () => {
    expect(getPlaneSurfaceScope("projects")).toBe("workspace");
    expect(getPlaneSurfaceScope("your-work")).toBe("workspace");
    expect(getPlaneSurfaceScope("drafts")).toBe("workspace");
    expect(getPlaneSurfaceScope("stickies")).toBe("workspace");
    expect(getPlaneSurfaceScope("home")).toBe("project");
    expect(getPlaneSurfaceScope("rfis")).toBe("project");
    expect(getPlaneSurfaceScope("submittals")).toBe("project");
    expect(getPlaneSurfaceScope("change-events")).toBe("project");
    expect(getPlaneSurfaceScope("commitments")).toBe("project");
    expect(getPlaneSurfaceScope("prime-contracts")).toBe("project");
  });

  it("dispatches every phase-three route slug to its replacement component", () => {
    const routeComponents = {
      home: "PlaneHomePage",
      projects: "PlaneProjectsSurface",
      "your-work": "PlaneYourWorkSurface",
      drafts: "PlaneDraftsPage",
      stickies: "PlaneStickiesPage",
      rfis: "PlaneRfisSurface",
      submittals: "PlaneSubmittalsPage",
      "change-events": "PlaneChangeEventsSurface",
      commitments: "PlaneCommitmentsPage",
      "prime-contracts": "PlanePrimeContractsPage",
    } as const;

    for (const [surface, component] of Object.entries(routeComponents)) {
      expect(dispatcherSource).toContain(`case "${surface}":`);
      expect(dispatcherSource).toContain(`<${component}`);
    }
  });

  it("keeps one embedded Work Items shell and wraps every sibling surface", () => {
    expect(shouldWrapPlaneSurfaceInDispatcherShell("work-items")).toBe(false);
    expect(
      [
        "home",
        "projects",
        "your-work",
        "drafts",
        "stickies",
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
      ].every(shouldWrapPlaneSurfaceInDispatcherShell),
    ).toBe(true);
  });
});
