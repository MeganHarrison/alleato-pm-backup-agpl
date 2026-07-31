import { rfiBaseSchema, rfiEditSchema } from "./rfi-schema";

const validRfi = {
  subject: "Clarify storefront detail",
};

describe("RFI number validation", () => {
  it("allows an omitted number so the create API can assign the next project number", () => {
    expect(rfiBaseSchema.safeParse(validRfi).success).toBe(true);
  });

  it.each([0, -1, 1.5])("rejects invalid RFI number %s", (number) => {
    const result = rfiEditSchema.safeParse({ number });

    expect(result.success).toBe(false);
  });

  it("accepts a positive whole RFI number for custom project conventions", () => {
    expect(rfiEditSchema.safeParse({ number: 42 }).data).toEqual(
      expect.objectContaining({ number: 42 }),
    );
  });
});
