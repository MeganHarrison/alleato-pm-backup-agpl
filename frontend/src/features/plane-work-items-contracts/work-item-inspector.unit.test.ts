import {
  getPlaneWorkItemInspectorContract,
  getPlaneWorkItemsRecovery,
} from "./work-item-inspector";

describe("Plane Work Items inspector contract", () => {
  it("uses Plane side peek on desktop and a focus-trapped sheet on mobile", () => {
    expect(getPlaneWorkItemInspectorContract("task-1", 1440)).toMatchObject({
      presentation: "side-peek",
      width: "min(560px, 46vw)",
      modal: false,
      focusTrap: false,
    });
    expect(getPlaneWorkItemInspectorContract("task-1", 390)).toMatchObject({
      presentation: "mobile-sheet",
      width: "100vw",
      modal: true,
      focusTrap: true,
    });
  });

  it("keeps inspector closed without a canonical peek id", () => {
    expect(getPlaneWorkItemInspectorContract(" ", 1440)).toBeNull();
  });
});

describe("Plane Work Items missing and denied recovery", () => {
  it("clears a missing inspector but navigates away from a missing collection", () => {
    expect(getPlaneWorkItemsRecovery(404, "inspector")).toMatchObject({
      kind: "missing",
      action: "clear-peek",
    });
    expect(getPlaneWorkItemsRecovery(404, "collection")).toMatchObject({
      kind: "missing",
      action: "go-back",
    });
  });

  it("distinguishes permission denial from a retryable failure", () => {
    expect(getPlaneWorkItemsRecovery(401, "collection")).toMatchObject({
      kind: "unauthenticated",
      action: "sign-in",
    });
    expect(getPlaneWorkItemsRecovery(403, "collection")).toMatchObject({
      kind: "denied",
      action: "go-back",
    });
    expect(getPlaneWorkItemsRecovery(500, "collection")).toMatchObject({
      kind: "unavailable",
      action: "retry",
    });
  });
});
