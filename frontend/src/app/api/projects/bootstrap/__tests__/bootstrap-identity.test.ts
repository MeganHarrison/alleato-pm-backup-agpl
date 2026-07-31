import { buildBootstrapProjectIdentity } from "../bootstrap-identity";

describe("buildBootstrapProjectIdentity", () => {
  it("creates a unique request-scoped default name and project number", () => {
    expect(
      buildBootstrapProjectIdentity({
        templateName: "Test Warehouse Project",
        templateProjectNumber: "WH-2025-001",
        requestId: "11111111-2222-4333-8444-555555555555",
      }),
    ).toEqual({
      projectName: "Test Warehouse Project 111111112222",
      projectNumber: "WH-2025-001-111111112222",
    });
  });

  it("preserves a non-empty custom name while retaining a unique number", () => {
    expect(
      buildBootstrapProjectIdentity({
        templateName: "Test Warehouse Project",
        templateProjectNumber: "WH-2025-001",
        customName: "  Custom Audit Project  ",
        requestId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      }),
    ).toEqual({
      projectName: "Custom Audit Project",
      projectNumber: "WH-2025-001-aaaaaaaabbbb",
    });
  });

  it("fails loudly when request attribution cannot provide uniqueness", () => {
    expect(() =>
      buildBootstrapProjectIdentity({
        templateName: "Test Warehouse Project",
        templateProjectNumber: "WH-2025-001",
        requestId: "---",
      }),
    ).toThrow("requires a request correlation ID");
  });
});
