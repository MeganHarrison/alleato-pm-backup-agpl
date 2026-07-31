/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getPlaneSourceInfo, PLANE_SOURCE_REPOSITORY_URL } from "./source-info";

describe("Plane corresponding-source contract", () => {
  const originalRevision = process.env.AGPL_SOURCE_COMMIT_SHA;

  afterEach(() => {
    if (originalRevision === undefined) {
      delete process.env.AGPL_SOURCE_COMMIT_SHA;
    } else {
      process.env.AGPL_SOURCE_COMMIT_SHA = originalRevision;
    }
  });

  it("links the source offer to the exact public source snapshot", () => {
    const revision = "a".repeat(40);
    process.env.AGPL_SOURCE_COMMIT_SHA = revision;

    expect(getPlaneSourceInfo()).toEqual(
      expect.objectContaining({
        revision,
        sourceUrl: `${PLANE_SOURCE_REPOSITORY_URL}/tree/${revision}`,
        license: "AGPL-3.0-only",
        noticeUrl: "/auth/source",
      }),
    );
  });

  it("falls back to the repository without claiming an exact revision locally", () => {
    delete process.env.AGPL_SOURCE_COMMIT_SHA;

    expect(getPlaneSourceInfo()).toEqual(
      expect.objectContaining({
        revision: null,
        sourceUrl: PLANE_SOURCE_REPOSITORY_URL,
        noticeUrl: "/auth/source",
      }),
    );
  });
});
