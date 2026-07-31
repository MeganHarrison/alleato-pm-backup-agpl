import { areSemanticallySimilar } from "../text-dedupe";

describe("areSemanticallySimilar", () => {
  it("treats near-duplicate risk title and detail as the same", () => {
    expect(
      areSemanticallySimilar(
        "Hazmat bracket sourcing remains unresolved, and delays in installation progress remain likely.",
        "Hazmat bracket sourcing remains unresolved, and delays in finding a stronger design could block installation progress.",
        0.5,
      ),
    ).toBe(true);
  });

  it("keeps materially different risk detail visible", () => {
    expect(
      areSemanticallySimilar(
        "Rack readiness is on a tight deadline.",
        "Worst-case availability by July 10 could block branch line and riser sequencing.",
        0.5,
      ),
    ).toBe(false);
  });
});
