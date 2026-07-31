import type { RFI } from "@/types/database-extensions";
import {
  filterPlaneRfis,
  formatPlaneRfiIdentifier,
  planeRfiMatchesStatus,
} from "./plane-rfis-model";

function rfi(
  overrides: Partial<
    Pick<
      RFI,
      | "id"
      | "number"
      | "subject"
      | "question"
      | "status"
      | "assignees"
      | "ball_in_court"
      | "rfi_manager"
    >
  >,
): RFI {
  return {
    id: overrides.id ?? "rfi-1",
    number: overrides.number ?? 1,
    subject: overrides.subject ?? "Clarify storefront framing",
    question: overrides.question ?? "Confirm the required attachment.",
    status: overrides.status ?? "open",
    assignees: overrides.assignees ?? ["Architect"],
    ball_in_court: overrides.ball_in_court ?? "Architect",
    rfi_manager: overrides.rfi_manager ?? "Project Manager",
  } as RFI;
}

describe("Plane RFIs model", () => {
  it("maps the canonical RFI lifecycle into Plane open and closed filters", () => {
    expect(planeRfiMatchesStatus(rfi({ status: "draft" }), "open")).toBe(true);
    expect(planeRfiMatchesStatus(rfi({ status: "answered" }), "open")).toBe(
      true,
    );
    expect(planeRfiMatchesStatus(rfi({ status: "closed" }), "closed")).toBe(
      true,
    );
    expect(
      planeRfiMatchesStatus(rfi({ status: "closed-draft" }), "closed"),
    ).toBe(true);
  });

  it("searches actionable fields and keeps newest RFI numbers first", () => {
    const result = filterPlaneRfis(
      [
        rfi({ id: "older", number: 4, ball_in_court: "Owner" }),
        rfi({ id: "newer", number: 12, subject: "Owner ceiling decision" }),
        rfi({ id: "closed", number: 20, status: "closed" }),
      ],
      "open",
      "owner",
    );

    expect(result.map((item) => item.id)).toEqual(["newer", "older"]);
  });

  it("formats a stable Plane-style record identifier", () => {
    expect(formatPlaneRfiIdentifier(7)).toBe("RFI-007");
    expect(formatPlaneRfiIdentifier(104)).toBe("RFI-104");
  });
});
