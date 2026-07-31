import {
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
  it("accepts only positive safe integer project ids", () => {
    expect(parsePlaneProjectId("31")).toBe(31);
    expect(parsePlaneProjectId("0")).toBeNull();
    expect(parsePlaneProjectId("-1")).toBeNull();
    expect(parsePlaneProjectId("31x")).toBeNull();
    expect(parsePlaneProjectId(String(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
  });

  it("accepts only the six supported replacement surfaces", () => {
    expect(
      ["work-items", "cycles", "modules", "views", "pages", "intake"].every(
        isPlaneSurface,
      ),
    ).toBe(true);
    expect(isPlaneSurface("tasks")).toBe(false);
  });

  it("keeps one embedded Work Items shell and wraps every sibling surface", () => {
    expect(shouldWrapPlaneSurfaceInDispatcherShell("work-items")).toBe(false);
    expect(
      ["cycles", "modules", "views", "pages", "intake"].every(
        shouldWrapPlaneSurfaceInDispatcherShell,
      ),
    ).toBe(true);
  });
});
