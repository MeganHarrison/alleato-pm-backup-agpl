import { isUuidLookupKey } from "../data-access";

describe("isUuidLookupKey", () => {
  it("only sends UUID-shaped content keys to the UUID lookup", () => {
    expect(isUuidLookupKey("efcfe6fa-3a1e-4fa6-9e75-b1536e3eab57")).toBe(true);
    expect(isUuidLookupKey("docs-create-prime-contract-walkthrough")).toBe(false);
  });
});
