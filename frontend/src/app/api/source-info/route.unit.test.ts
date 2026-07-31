/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { GET } from "./route";

describe("GET /api/source-info", () => {
  const originalRevision = process.env.AGPL_SOURCE_COMMIT_SHA;

  afterEach(() => {
    if (originalRevision === undefined) {
      delete process.env.AGPL_SOURCE_COMMIT_SHA;
    } else {
      process.env.AGPL_SOURCE_COMMIT_SHA = originalRevision;
    }
  });

  it("publicly returns the exact deployed source URL", async () => {
    const revision = "b".repeat(40);
    process.env.AGPL_SOURCE_COMMIT_SHA = revision;

    const response = GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        revision,
        sourceUrl: `https://github.com/MeganHarrison/alleato-pm-backup-agpl/tree/${revision}`,
        license: "AGPL-3.0-only",
        noticeUrl: "/auth/source",
      }),
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
