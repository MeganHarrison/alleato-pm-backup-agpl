import { isLikelyRecordIdentifier } from "./breadcrumb-utils";

describe("isLikelyRecordIdentifier", () => {
  it("recognizes UUID and numeric detail segments", () => {
    expect(isLikelyRecordIdentifier("a9e0139a-ceb1-4ace-b81c-28a27dd217cc", 2)).toBe(true);
    expect(isLikelyRecordIdentifier("12345", 2)).toBe(true);
  });

  it("does not classify the project segment or readable route names as IDs", () => {
    expect(isLikelyRecordIdentifier("1142", 0)).toBe(false);
    expect(isLikelyRecordIdentifier("punch-list", 1)).toBe(false);
  });
});
