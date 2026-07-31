import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("outlook draft feedback access contract", () => {
  const routeDir = join(
    process.cwd(),
    "src/app/(admin)/outlook-draft-feedback",
  );

  it("keeps owner-or-Brandon access in the layout without reapplying admin-only page access", () => {
    const layoutSource = readFileSync(join(routeDir, "layout.tsx"), "utf8");
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");

    expect(layoutSource).toContain("requireOwnerOrEmails");
    expect(layoutSource).toContain("bclymer@alleatogroup.com");
    expect(pageSource).not.toContain("requireAdmin");
  });

  it("keeps the training page on the shared Emails layout scoped to Brandon's mailbox", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");

    expect(pageSource).toContain("EmailsClient");
    expect(pageSource).toContain('source="outlook"');
    expect(pageSource).toContain("mailboxUserId={BRANDON_MAILBOX}");
    expect(pageSource).not.toContain("EmailInboxClient");
    expect(pageSource).not.toContain("PageShell");
    expect(pageSource).not.toContain("<table");
    expect(pageSource).not.toContain("outlook_email_assistant_reviews");
    expect(pageSource).not.toContain("draft-reply");
    expect(pageSource).not.toContain("archive");
    expect(pageSource).not.toContain("graph.microsoft.com");
  });
});
