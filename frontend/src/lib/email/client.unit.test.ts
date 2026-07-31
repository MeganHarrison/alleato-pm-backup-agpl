import {
  DEFAULT_APP_BASE_URL,
  resolveAppBaseUrl,
  sanitizeFromAddress,
} from "./client";

describe("sanitizeFromAddress", () => {
  it("strips a trailing newline that would make Resend reject every send", () => {
    // Regression: 2026-06-24 incident — `EMAIL_FROM_ADDRESS` held a literal "\n",
    // so Resend returned validation_error and ALL transactional email died silently.
    expect(sanitizeFromAddress("Alleato <info@alleatogroup.com>\n")).toBe(
      "Alleato <info@alleatogroup.com>",
    );
  });

  it("strips carriage returns, tabs, and surrounding whitespace", () => {
    expect(sanitizeFromAddress("  Alleato <info@alleatogroup.com>\r\n\t")).toBe(
      "Alleato <info@alleatogroup.com>",
    );
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(sanitizeFromAddress("Alleato   <info@alleatogroup.com>")).toBe(
      "Alleato <info@alleatogroup.com>",
    );
  });

  it("leaves a clean address untouched", () => {
    expect(sanitizeFromAddress("Alleato <info@alleatogroup.com>")).toBe(
      "Alleato <info@alleatogroup.com>",
    );
  });
});

describe("resolveAppBaseUrl", () => {
  it("defaults email links to the production projects host", () => {
    expect(resolveAppBaseUrl(undefined)).toBe(DEFAULT_APP_BASE_URL);
  });

  it("normalizes retired hosts to the production projects host", () => {
    expect(resolveAppBaseUrl("https://app.alleato.com")).toBe(DEFAULT_APP_BASE_URL);
    expect(resolveAppBaseUrl("https://app.alleato.com/auth/confirm")).toBe(DEFAULT_APP_BASE_URL);
    expect(resolveAppBaseUrl("https://alleato-procore.vercel.app/daily-briefs/packet-1")).toBe(DEFAULT_APP_BASE_URL);
    expect(resolveAppBaseUrl("https://www.alleato-procore.vercel.app")).toBe(DEFAULT_APP_BASE_URL);
  });

  it("keeps valid non-legacy origins and strips trailing paths", () => {
    expect(resolveAppBaseUrl("http://localhost:3000/auth/callback")).toBe("http://localhost:3000");
    expect(resolveAppBaseUrl("https://preview.example.com/")).toBe("https://preview.example.com");
  });

  it("fails loudly for invalid URL configuration", () => {
    expect(() => resolveAppBaseUrl("projects.alleatogroup.com")).toThrow(
      /Invalid NEXT_PUBLIC_APP_URL/,
    );
  });
});
