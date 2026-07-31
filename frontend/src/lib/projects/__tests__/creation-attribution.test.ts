import { buildRequestProjectCreationAttribution } from "../creation-attribution";

describe("buildRequestProjectCreationAttribution", () => {
  it("builds the immutable request attribution fields", () => {
    expect(
      buildRequestProjectCreationAttribution({
        source: "web_app",
        actorUserId: " user-123 ",
        requestId: " request-456 ",
      }),
    ).toEqual({
      created_by: "user-123",
      created_via: "web_app",
      creation_request_id: "request-456",
      creation_run_id: null,
    });
  });

  it("fails loudly when actor or request evidence is missing", () => {
    expect(() =>
      buildRequestProjectCreationAttribution({
        source: "api",
        actorUserId: "",
        requestId: "request-456",
      }),
    ).toThrow("authenticated actor");

    expect(() =>
      buildRequestProjectCreationAttribution({
        source: "api",
        actorUserId: "user-123",
        requestId: " ",
      }),
    ).toThrow("request correlation ID");
  });
});
