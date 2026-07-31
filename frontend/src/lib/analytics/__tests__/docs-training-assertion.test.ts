jest.mock("server-only", () => ({}));

import {
  DocsTrainingAssertionError,
  issueDocsTrainingAssertion,
  verifyDocsTrainingAssertion,
} from "@/lib/analytics/docs-training-assertion";
import {
  attributedDocsHref,
  docsPathFromUrl,
} from "@/lib/analytics/docs-link";

const USER_ID = "123e4567-e89b-42d3-a456-426614174000";
const SECRET = "test-only-training-assertion-secret-with-adequate-length";
const ISSUED_AT = new Date("2026-07-31T18:00:00.000Z");

describe("docs training assertions", () => {
  it("round-trips an opaque, purpose-limited user assertion", () => {
    const token = issueDocsTrainingAssertion(USER_ID, "prime-contracts/create-a-prime-contract", {
      now: ISSUED_AT,
      secret: SECRET,
    });

    expect(token).not.toContain(USER_ID);
    expect(Buffer.from(token.split(".")[2] ?? "", "base64url").toString("utf8"))
      .not.toContain(USER_ID);
    expect(
      verifyDocsTrainingAssertion(token, {
        now: new Date("2026-07-31T18:29:59.000Z"),
        secret: SECRET,
      }),
    ).toMatchObject({
      subject: USER_ID,
      sourceId: "prime-contracts/create-a-prime-contract",
      audience: "docs.alleatogroup.com",
      purpose: "training-progress",
    });
  });

  it("rejects an expired assertion", () => {
    const token = issueDocsTrainingAssertion(USER_ID, "prime-contracts/create-a-prime-contract", {
      now: ISSUED_AT,
      secret: SECRET,
    });

    expect(() =>
      verifyDocsTrainingAssertion(token, {
        now: new Date("2026-07-31T18:30:00.000Z"),
        secret: SECRET,
      }),
    ).toThrow(new DocsTrainingAssertionError("expired"));
  });

  it("rejects a token issued for another audience", () => {
    const token = issueDocsTrainingAssertion(USER_ID, "prime-contracts/create-a-prime-contract", {
      now: ISSUED_AT,
      secret: SECRET,
      audience: "untrusted.example",
    });

    expect(() =>
      verifyDocsTrainingAssertion(token, {
        now: ISSUED_AT,
        secret: SECRET,
      }),
    ).toThrow(new DocsTrainingAssertionError("wrong_audience"));
  });

  it("rejects tampering and a different encryption secret", () => {
    const token = issueDocsTrainingAssertion(USER_ID, "prime-contracts/create-a-prime-contract", {
      now: ISSUED_AT,
      secret: SECRET,
    });
    const parts = token.split(".");
    const ciphertext = parts[2] ?? "";
    parts[2] = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;
    const tampered = parts.join(".");

    expect(() =>
      verifyDocsTrainingAssertion(tampered, {
        now: ISSUED_AT,
        secret: SECRET,
      }),
    ).toThrow(new DocsTrainingAssertionError("invalid"));
    expect(() =>
      verifyDocsTrainingAssertion(token, {
        now: ISSUED_AT,
        secret: `${SECRET}-different`,
      }),
    ).toThrow(new DocsTrainingAssertionError("invalid"));
  });
});

describe("attributed docs links", () => {
  it("routes canonical and legacy docs URLs through the authenticated issuer", () => {
    expect(
      attributedDocsHref(
        "https://docs.alleatogroup.com/prime-contracts/create-a-prime-contract?mode=training",
      ),
    ).toBe(
      "/api/engagement/docs/link?path=%2Fprime-contracts%2Fcreate-a-prime-contract%3Fmode%3Dtraining",
    );
    expect(
      docsPathFromUrl("https://alleato-docs-site.vercel.app/invoicing/create-an-owner-invoice"),
    ).toBe("/invoicing/create-an-owner-invoice");
  });

  it("does not proxy an unrelated external learning source", () => {
    expect(attributedDocsHref("https://example.com/course"))
      .toBe("https://example.com/course");
  });
});
