/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
  normalizePlaneWorkItemStatus,
  planeWorkItemIdentifier,
  planeWorkItemStatusLabel,
  planeWorkItemTitle,
} from "./plane-work-items-model";

describe("Plane Work Items presentation model", () => {
  it.each([
    ["open", "open"],
    ["pending", "open"],
    ["in_progress", "in_progress"],
    ["active", "in_progress"],
    ["done", "done"],
    ["completed", "done"],
    ["cancelled", "done"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(normalizePlaneWorkItemStatus(input)).toBe(expected);
  });

  it("uses Plane-facing labels for Alleato task states", () => {
    expect(planeWorkItemStatusLabel("open")).toBe("Backlog");
    expect(planeWorkItemStatusLabel("in_progress")).toBe("In progress");
    expect(planeWorkItemStatusLabel("done")).toBe("Done");
  });

  it("prefers the live task description and provides safe fallbacks", () => {
    expect(
      planeWorkItemTitle({
        id: "task-104",
        description: "Coordinate the revised schedule.",
        title: "Schedule",
      }),
    ).toBe("Coordinate the revised schedule.");
    expect(planeWorkItemTitle({ id: "task-105", title: "Schedule" })).toBe(
      "Schedule",
    );
    expect(planeWorkItemTitle({ id: "task-106" })).toBe("Untitled work item");
  });

  it("builds a compact project-facing identifier from the task id", () => {
    expect(planeWorkItemIdentifier({ id: "task-123974" }, 0)).toBe(
      "ALLEATO-974",
    );
    expect(planeWorkItemIdentifier({ id: "task-no-number" }, 6)).toBe(
      "ALLEATO-7",
    );
  });
});
