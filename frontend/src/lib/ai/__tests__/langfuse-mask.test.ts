import { redactPII, maskLangfuse } from "../langfuse-mask";

describe("redactPII", () => {
  it("redacts email addresses", () => {
    expect(redactPII("contact brandon@alleatogroup.com about it")).toBe(
      "contact ***EMAIL*** about it",
    );
  });

  it("redacts SSNs and card/phone numbers", () => {
    expect(redactPII("SSN 123-45-6789")).toBe("SSN ***SSN***");
    expect(redactPII("card 4111-1111-1111-1111")).toBe("card ***CARD***");
    expect(redactPII("call (317) 555-1234")).toContain("***PHONE***");
  });

  it("does NOT mask dollar amounts or business/financial data", () => {
    const text = "AR aging: $120,000 current, $30,000 over 60 days on project 1009";
    expect(redactPII(text)).toBe(text);
  });

  it("does NOT mask plain numbers / ids", () => {
    expect(redactPII("project 43, contract value 250000")).toBe(
      "project 43, contract value 250000",
    );
  });

  it("redacts multiple emails in one string", () => {
    expect(redactPII("a@x.com and b@y.org")).toBe("***EMAIL*** and ***EMAIL***");
  });
});

describe("maskLangfuse callback", () => {
  it("redacts string data", () => {
    expect(maskLangfuse({ data: "email a@b.com" })).toBe("email ***EMAIL***");
  });

  it("passes non-string data through unchanged", () => {
    const obj = { foo: "bar" };
    expect(maskLangfuse({ data: obj })).toBe(obj);
    expect(maskLangfuse({ data: 42 })).toBe(42);
    expect(maskLangfuse({ data: null })).toBe(null);
  });
});
