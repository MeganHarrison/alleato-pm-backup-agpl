import { requiredEveBaseUrl } from "../eve-proxy";

describe("Eve proxy production configuration", () => {
  it("accepts only a bare HTTPS origin", () => {
    expect(requiredEveBaseUrl("https://eve.example.test")).toBe(
      "https://eve.example.test/",
    );
  });

  it("allows a bare localhost HTTP origin only when explicitly enabled", () => {
    expect(
      requiredEveBaseUrl("http://localhost:3003", {
        allowLocalHttp: true,
      }),
    ).toBe("http://localhost:3003/");
    expect(() => requiredEveBaseUrl("http://localhost:3003")).toThrow(
      /use https/,
    );
  });

  it.each([
    "http://eve.example.test",
    "http://192.168.1.30:3003",
    "https://eve.example.test/prefix",
    "https://eve.example.test/?query=value",
    "https://user:secret@eve.example.test",
    "https://eve.example.test/#fragment",
  ])("fails loudly for non-origin configuration %s", (configured) => {
    expect(() => requiredEveBaseUrl(configured)).toThrow(
      /HTTPS origin|use https/,
    );
  });
});
