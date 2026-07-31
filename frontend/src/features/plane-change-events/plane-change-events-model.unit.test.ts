import type { ChangeEvent } from "@/types/change-events";
import {
  filterPlaneChangeEvents,
  formatPlaneChangeEventDate,
  formatPlaneChangeEventIdentifier,
} from "./plane-change-events-model";

function changeEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    id: "change-event-1",
    project_id: 31,
    number: "CE-017",
    title: "Revise storefront framing",
    type: "Design Change",
    reason: "Design Development",
    scope: "In Scope",
    status: "Open",
    origin: "RFI",
    description: "Coordinate the revised attachment.",
    expecting_revenue: true,
    line_item_revenue_source: "Match Revenue to Latest Cost",
    prime_contract_id: null,
    created_at: "2026-07-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("Plane Change Events model", () => {
  it("searches the actionable list and downstream linkage fields", () => {
    const result = filterPlaneChangeEvents(
      [
        changeEvent({ id: "scope-match", scope: "Allowance" }),
        changeEvent({ id: "rfq-match", rfq_title: "Allowance pricing" }),
        changeEvent({ id: "miss", title: "Lobby paint" }),
      ],
      "allowance",
    );

    expect(result.map((event) => event.id)).toEqual([
      "scope-match",
      "rfq-match",
    ]);
  });

  it("formats canonical and fallback identifiers", () => {
    expect(formatPlaneChangeEventIdentifier(changeEvent())).toBe("CE-017");
    expect(
      formatPlaneChangeEventIdentifier(changeEvent({ id: "abc", number: null })),
    ).toBe("CE-abc");
  });

  it("formats created dates for the detail surface", () => {
    expect(formatPlaneChangeEventDate("2026-08-05T12:00:00.000Z")).toBe(
      "Aug 5, 2026",
    );
    expect(formatPlaneChangeEventDate(null)).toBe("No date");
  });
});
