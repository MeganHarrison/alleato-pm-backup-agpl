import fs from "node:fs";
import path from "node:path";

const homePagePath = path.join(process.cwd(), "src/app/(main)/home/page.tsx");

describe("home action dashboard contract", () => {
  it("keeps the page organized around visible meetings before secondary queues", () => {
    const source = fs.readFileSync(homePagePath, "utf8");

    expect(source).toContain('"Upcoming meetings"');
    expect(source).toContain('"Work queue"');
    expect(source).toContain('"Resume projects"');
    expect(source).toContain('"Review queue"');
    expect(source).toContain('"Recent movement"');

    expect(source.indexOf('"Upcoming meetings"')).toBeLessThan(
      source.indexOf('"Work queue"'),
    );
    expect(source).not.toContain('"Start here"');
    expect(source).not.toContain('"Source wiring"');
    expect(source).not.toContain("Pending source wiring");
  });

  it("keeps the AI profile discoverable from the review queue", () => {
    const source = fs.readFileSync(homePagePath, "utf8");

    expect(source).toContain('title="AI profile"');
    expect(source).toContain('href="/ai/profile"');
    expect(source).toContain("role, memory, and approval context");
  });

  it("keeps Outlook calendar meetings connected and fail-loud", () => {
    const source = fs.readFileSync(homePagePath, "utf8");

    expect(source).toContain("/api/home/outlook-calendar");
    expect(source).toContain("Outlook Calendar is not available.");
    expect(source).toContain(
      "No upcoming Outlook meetings in the next 7 days.",
    );
    expect(source).toContain("microsoft-graph-live");
    expect(source).toContain("visibleMeetings");
    expect(source).toContain("startsTodayOrLater");
  });
});
