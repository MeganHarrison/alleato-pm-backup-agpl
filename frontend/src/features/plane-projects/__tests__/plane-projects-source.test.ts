/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See LICENSES/NOTICE-PLANE.md for source and modification details.
 */

import {
  PLANE_PROJECTS_REVISION,
  PLANE_PROJECTS_SOURCE_OFFER_PATH,
  PLANE_PROJECTS_SOURCE_PATHS,
} from "../plane-projects-source";

describe("Plane Projects source mapping", () => {
  it("pins the exact upstream revision and public source-offer route", () => {
    expect(PLANE_PROJECTS_REVISION).toMatch(/^[a-f0-9]{40}$/);
    expect(PLANE_PROJECTS_SOURCE_OFFER_PATH).toBe("/auth/source");
  });

  it("records the Plane projects, header, filter, and card templates", () => {
    expect(PLANE_PROJECTS_SOURCE_PATHS).toEqual(
      expect.arrayContaining([
        "apps/web/core/components/project/root.tsx",
        "apps/web/core/components/project/header.tsx",
        "apps/web/core/components/project/filters.tsx",
        "apps/web/core/components/project/card-list.tsx",
        "apps/web/core/components/project/card.tsx",
      ]),
    );
  });
});
