/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { describe, expect, it } from "vitest";

import {
  PLANE_INTAKE_SOURCE_FILES,
  PLANE_INTAKE_SOURCE_REVISION,
} from "../plane-intake-source";

describe("Plane Intake source contract", () => {
  it("pins the exact Plane revision used for the adapted template", () => {
    expect(PLANE_INTAKE_SOURCE_REVISION).toBe(
      "39856932cd6b9bd17eab0920506d628190b47af2",
    );
  });

  it("records the upstream owners of each adapted Intake region", () => {
    expect(PLANE_INTAKE_SOURCE_FILES).toEqual(
      expect.arrayContaining([
        "apps/web/core/components/inbox/root.tsx",
        "apps/web/core/components/inbox/sidebar/root.tsx",
        "apps/web/core/components/inbox/sidebar/inbox-list-item.tsx",
        "apps/web/core/components/inbox/inbox-filter/root.tsx",
        "apps/web/core/components/inbox/content/inbox-issue-header.tsx",
        "apps/web/core/components/inbox/content/inbox-issue-mobile-header.tsx",
        "apps/web/core/components/inbox/content/issue-root.tsx",
        "apps/web/core/components/inbox/content/issue-properties.tsx",
      ]),
    );
  });
});
