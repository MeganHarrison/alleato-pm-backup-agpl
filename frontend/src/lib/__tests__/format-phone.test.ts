import { formatPhoneNumber } from "../format";

describe("formatPhoneNumber", () => {
  it.each([
    ["463-231-6390", "(463) 231-6390"],
    ["4632316390", "(463) 231-6390"],
    ["+1 (463) 231-6390", "(463) 231-6390"],
    ["463.231.6390 ext. 12", "(463) 231-6390 x12"],
  ])("formats %s", (value, expected) => {
    expect(formatPhoneNumber(value)).toBe(expected);
  });

  it("preserves phone values that cannot be safely recognized as North American", () => {
    expect(formatPhoneNumber("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });

  it("treats sync placeholder values as empty", () => {
    expect(formatPhoneNumber("{}")).toBe("");
    expect(formatPhoneNumber(null)).toBe("");
  });
});
