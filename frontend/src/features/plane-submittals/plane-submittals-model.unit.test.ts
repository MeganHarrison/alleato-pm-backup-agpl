/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { SubmittalSummary } from "@/hooks/use-submittals";

import {
  displaySubmittalDate,
  displaySubmittalType,
  filterSubmittals,
} from "./plane-submittals-model";

const baseSubmittal: SubmittalSummary = {
  id: "submittal-1",
  project_id: 31,
  submittal_number: "03 30 00-1",
  revision: 0,
  title: "Concrete mix design",
  status: "Open",
  priority: null,
  specification_section: "03 30 00",
  submittal_type: "Product Data",
  division: null,
  ball_in_court: "Architect",
  is_private: false,
  final_due_date: "2026-08-10",
  sent_date: null,
  deleted_at: null,
  created_at: "2026-07-31",
  updated_at: "2026-07-31",
};

describe("Plane Submittals model", () => {
  it("searches the canonical list fields and combines search with status", () => {
    const rows = [
      baseSubmittal,
      {
        ...baseSubmittal,
        id: "submittal-2",
        title: "Door hardware",
        status: "Draft",
        specification_section: "08 71 00",
      },
    ];

    expect(filterSubmittals(rows, "architect", "Open")).toEqual([
      baseSubmittal,
    ]);
    expect(filterSubmittals(rows, "door", "Open")).toEqual([]);
    expect(filterSubmittals(rows, "08 71", "all")).toEqual([rows[1]]);
  });

  it("formats typed and missing presentation values without changing data", () => {
    expect(displaySubmittalType({ id: "type-1", name: "Shop Drawing" })).toBe(
      "Shop Drawing",
    );
    expect(displaySubmittalType(null)).toBe("No type");
    expect(displaySubmittalDate("2026-08-10")).toBe("Aug 10, 2026");
    expect(displaySubmittalDate(null)).toBe("No due date");
    expect(displaySubmittalDate("not-a-date")).toBe("Invalid date");
  });
});
