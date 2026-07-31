/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PlaneIntakeLayout,
  PlaneIntakeStatusTabs,
} from "../plane-intake-client";

describe("Plane Intake template", () => {
  it("renders the Plane one-third split composition", () => {
    const html = renderToStaticMarkup(
      <PlaneIntakeLayout
        listPane={<div>Intake list</div>}
        detailPane={<div>Intake detail</div>}
      />,
    );

    expect(html).toContain('data-plane-intake-list-width="33.333333%"');
    expect(html).toContain("border-r");
    expect(html).toContain("Intake list");
    expect(html).toContain("Intake detail");
  });

  it("renders Plane underlined Open and Closed tabs with active semantics", () => {
    const html = renderToStaticMarkup(
      <PlaneIntakeStatusTabs
        tab="open"
        openCount={4}
        closedCount={2}
        onTabChange={vi.fn()}
      />,
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain(">Open<");
    expect(html).toContain(">Closed<");
    expect(html).toContain(">4<");
  });
});
