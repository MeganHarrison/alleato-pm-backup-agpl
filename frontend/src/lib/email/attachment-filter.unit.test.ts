import {
  dedupeAttachmentsByChecksum,
  filterEmailAttachments,
  isDecorativeAttachment,
} from "./attachment-filter";

const att = (overrides: Partial<Parameters<typeof isDecorativeAttachment>[0]> = {}) => ({
  fileName: "report.pdf",
  contentType: "application/pdf",
  fileSize: 250_000,
  checksumSha256: null,
  createdAt: null,
  ...overrides,
});

describe("isDecorativeAttachment", () => {
  test("non-image attachments are never decorative", () => {
    expect(isDecorativeAttachment(att({ fileName: "image.pdf", contentType: "application/pdf" }))).toBe(false);
  });

  test("Graph-generated inline image CIDs are decorative", () => {
    expect(
      isDecorativeAttachment(
        att({
          fileName: "1778876413604006_2095271004.png",
          contentType: "image/png",
          fileSize: 12_000,
        }),
      ),
    ).toBe(true);
  });

  test("classic image001.png signature image is decorative", () => {
    expect(
      isDecorativeAttachment(
        att({ fileName: "image001.png", contentType: "image/png", fileSize: 8_000 }),
      ),
    ).toBe(true);
  });

  test("plain image.png is decorative", () => {
    expect(
      isDecorativeAttachment(
        att({ fileName: "image.png", contentType: "image/png", fileSize: 5_000 }),
      ),
    ).toBe(true);
  });

  test("social brand icons are decorative", () => {
    for (const name of ["linkedin.png", "facebook.jpg", "instagram2.png", "logo.svg"]) {
      expect(
        isDecorativeAttachment(
          att({ fileName: name, contentType: "image/png", fileSize: 6_000 }),
        ),
      ).toBe(true);
    }
  });

  test("small image with arbitrary name is decorative", () => {
    expect(
      isDecorativeAttachment(
        att({ fileName: "headshot.jpg", contentType: "image/jpeg", fileSize: 18_000 }),
      ),
    ).toBe(true);
  });

  test("large image with meaningful name is kept", () => {
    expect(
      isDecorativeAttachment(
        att({
          fileName: "site-photo-2026-05-18.jpg",
          contentType: "image/jpeg",
          fileSize: 850_000,
        }),
      ),
    ).toBe(false);
  });

  test("outlook prefixed inline images are decorative", () => {
    expect(
      isDecorativeAttachment(
        att({ fileName: "outlook-1234.png", contentType: "image/png", fileSize: 9_000 }),
      ),
    ).toBe(true);
  });
});

describe("dedupeAttachmentsByChecksum", () => {
  test("collapses duplicates by checksum, keeping the most recent", () => {
    const result = dedupeAttachmentsByChecksum([
      att({ fileName: "a.png", checksumSha256: "abc", createdAt: "2026-05-10T00:00:00Z" }),
      att({ fileName: "b.png", checksumSha256: "abc", createdAt: "2026-05-15T00:00:00Z" }),
      att({ fileName: "c.png", checksumSha256: "xyz", createdAt: "2026-05-12T00:00:00Z" }),
    ]);

    expect(result).toHaveLength(2);
    const abc = result.find((r) => r.checksumSha256 === "abc");
    expect(abc?.fileName).toBe("b.png");
  });

  test("attachments without checksums pass through", () => {
    const result = dedupeAttachmentsByChecksum([
      att({ fileName: "a.png", checksumSha256: null }),
      att({ fileName: "b.png", checksumSha256: null }),
    ]);

    expect(result).toHaveLength(2);
  });
});

describe("filterEmailAttachments", () => {
  test("drops decorative attachments AND dedupes the rest by checksum", () => {
    const result = filterEmailAttachments([
      att({
        fileName: "image001.png",
        contentType: "image/png",
        fileSize: 8_000,
        checksumSha256: "sig",
      }),
      att({
        fileName: "Commitment.pdf",
        contentType: "application/pdf",
        fileSize: 250_000,
        checksumSha256: "pdf1",
        createdAt: "2026-05-10T00:00:00Z",
      }),
      att({
        fileName: "Commitment-copy.pdf",
        contentType: "application/pdf",
        fileSize: 250_000,
        checksumSha256: "pdf1",
        createdAt: "2026-05-15T00:00:00Z",
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.fileName).toBe("Commitment-copy.pdf");
  });
});
