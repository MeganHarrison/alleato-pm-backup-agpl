jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("../actions", () => ({ submitFmGlobalSpecs: jest.fn() }));

import { buildPayload } from "../fm-global-client";
import { defaultFormState } from "../fm-global-form";

describe("public FM Global transverse-flue intake mapping", () => {
  it("does not discard entered continuity flags when adequacy dimensions are missing", () => {
    const result = buildPayload({
      ...defaultFormState,
      contactName: "FMDS verification",
      contactEmail: "test1@mail.com",
      projectName: "FMDS verification",
      asrsType: "shuttle",
      ceilingHeight: "40",
      kFactor: "16.8",
      designSprinklerCount: "12",
      verticallyAligned: true,
    });

    expect(result).toBe(
      "Distance, actual net width, vertical alignment, and full-height clearance are all required for adequacy.",
    );
  });

  it("returns named recovery for malformed open-width segments", () => {
    const result = buildPayload({
      ...defaultFormState,
      contactName: "FMDS verification",
      contactEmail: "test1@mail.com",
      projectName: "FMDS verification",
      asrsType: "shuttle",
      ceilingHeight: "40",
      kFactor: "16.8",
      designSprinklerCount: "12",
      openWidthsIn: "0.75, ",
    });

    expect(result).toBe(
      "Open Width Segments must be a comma-separated list of values greater than zero, without empty entries.",
    );
  });
});
