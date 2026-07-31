/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import fs from "node:fs";
import path from "node:path";

describe("Plane Your Work navigation", () => {
  it("opens project tasks in the Plane work-item inspector", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "plane-your-work-surface.tsx"),
      "utf8",
    );

    expect(source).toContain(
      "buildPlaneWorkItemsHref(projectId, { peekId: taskId })",
    );
    expect(source).not.toContain("/${projectId}/tasks");
    expect(source).not.toContain("href={`/tasks?scope=");
  });
});
