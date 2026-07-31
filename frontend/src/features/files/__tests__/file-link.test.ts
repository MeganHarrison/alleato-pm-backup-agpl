import { fileHref, isOutlookAttachment } from "../file-link";

const OUTLOOK_DEEPLINK =
  "https://outlook.office365.com/owa/?ItemID=AAMk123&exvsurl=1&viewmodel=ReadMessageItem";

describe("isOutlookAttachment", () => {
  it("detects by source_system", () => {
    expect(
      isOutlookAttachment({
        source_system: "outlook_attachment",
        source: "microsoft_graph",
        source_web_url: null,
      }),
    ).toBe(true);
  });

  it("detects by an outlook.office web link even without source_system", () => {
    expect(
      isOutlookAttachment({
        source_system: null,
        source: null,
        source_web_url: OUTLOOK_DEEPLINK,
      }),
    ).toBe(true);
  });

  it("does not match SharePoint / OneDrive files", () => {
    expect(
      isOutlookAttachment({
        source_system: "microsoft_graph",
        source: "onedrive",
        source_web_url: "https://alleato.sharepoint.com/sites/AlleatoGroup/Doc.aspx",
      }),
    ).toBe(false);
  });
});

describe("fileHref", () => {
  // Regression: clicking an Outlook attachment used to open the parent email in
  // Outlook because the link preferred `source_web_url` (the email deeplink).
  // It must now route through the server download endpoint instead.
  it("routes Outlook attachments to the download endpoint, NOT the email deeplink", () => {
    const href = fileHref({
      id: "outlook_attachment_abc_def",
      source_system: "outlook_attachment",
      source: "microsoft_graph",
      source_web_url: OUTLOOK_DEEPLINK,
      url: OUTLOOK_DEEPLINK,
    });
    expect(href).toBe("/api/files/outlook_attachment_abc_def/download");
    expect(href).not.toContain("outlook.office");
  });

  it("url-encodes the document id", () => {
    const href = fileHref({
      id: "weird id/with slashes",
      source_system: "outlook_attachment",
      source: null,
      source_web_url: OUTLOOK_DEEPLINK,
      url: null,
    });
    expect(href).toBe("/api/files/weird%20id%2Fwith%20slashes/download");
  });

  it("uses the direct web URL for SharePoint / OneDrive files", () => {
    const sharepoint = "https://alleato.sharepoint.com/sites/AlleatoGroup/Doc.aspx";
    expect(
      fileHref({
        id: "1",
        source_system: "microsoft_graph",
        source: "onedrive",
        source_web_url: sharepoint,
        url: sharepoint,
      }),
    ).toBe(sharepoint);
  });

  it("falls back to url when source_web_url is absent", () => {
    const storage =
      "https://lgveqfnpkxvzbnnwuled.supabase.co/storage/v1/object/public/meetings/x.json";
    expect(
      fileHref({
        id: "2",
        source_system: "fireflies",
        source: "fireflies",
        source_web_url: null,
        url: storage,
      }),
    ).toBe(storage);
  });

  it("returns null when there is no link at all", () => {
    expect(
      fileHref({
        id: "3",
        source_system: "manual",
        source: null,
        source_web_url: null,
        url: null,
      }),
    ).toBeNull();
  });
});
