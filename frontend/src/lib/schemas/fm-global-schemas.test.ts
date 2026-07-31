import { describe, expect, it } from "vitest";
import { fmGlobalSpecInputSchema } from "@/lib/schemas/fm-global-schemas";

describe("fmGlobalSpecInputSchema", () => {
  it("rejects missing required fields", () => {
    const result = fmGlobalSpecInputSchema.safeParse({
      asrs_type: "Shuttle",
      system_type: "wet",
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid input", () => {
    const result = fmGlobalSpecInputSchema.safeParse({
      asrs_type: "Mini-Load",
      system_type: "dry",
      ceiling_height_ft: 30,
      tolerance_ft: 5,
    });

    expect(result.success).toBe(true);
  });
});
