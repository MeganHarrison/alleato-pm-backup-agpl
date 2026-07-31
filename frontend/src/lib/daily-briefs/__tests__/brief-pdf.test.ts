import { buildCanonicalDailyBriefPdfHtml } from "../brief-pdf";
import type { CanonicalDailyBriefPacket } from "../canonical-packets";

const basePacket: CanonicalDailyBriefPacket = {
  id: "packet-1",
  targetId: "target-1",
  packetType: "current",
  generatedAt: "2026-07-07T05:32:00.000Z",
  coveredStartAt: "2026-07-06T00:00:00.000Z",
  coveredEndAt: "2026-07-06T23:59:59.000Z",
  freshnessStatus: "fresh",
  businessDate: "2026-07-06",
  title: "Daily Executive Brief - 2026-07-06",
  executiveSummary: "Executive read",
  currentStatus: "On track",
  strategicRead: null,
  whyItMatters: null,
  recommendedNextMoves: ["Call Jason", "Sign the check batch"],
  confidenceSummary: {},
  sourceCoverage: {},
  sourceCounts: { email: 2, meeting: 1 },
  sourceIds: ["source-1", "source-2", "source-3"],
  sources: [],
  sourceCount: 3,
  briefMarkdown: "## Union Collective\nLock the solar basis.",
  sections: [
    { title: "Union Collective", body: "Lock the solar basis.\nSize roof for 250 kW." },
    { title: "Exol Morrisville", body: "Schedule is due Wednesday." },
  ],
  brief: null,
  compilerVersion: "manual-v1",
};

describe("buildCanonicalDailyBriefPdfHtml", () => {
  it("renders a self-contained document with title, business date, and sections", () => {
    const html = buildCanonicalDailyBriefPdfHtml(basePacket);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Daily Executive Brief - 2026-07-06");
    expect(html).toContain("Business date: 2026-07-06");
    expect(html).toContain("Union Collective");
    expect(html).toContain("Exol Morrisville");
    // Recommended next moves surface as a list.
    expect(html).toContain("Recommended next moves");
    expect(html).toContain("Call Jason");
    // No external asset references — must render identically in serverless chromium.
    expect(html).not.toMatch(/src=|href=|<link|@import/);
  });

  it("escapes HTML in packet content to prevent broken/injected markup", () => {
    const html = buildCanonicalDailyBriefPdfHtml({
      ...basePacket,
      title: 'Brief <script>alert("x")</script>',
      sections: [{ title: "R&D <b>", body: "cost < 5 & risk > 0" }],
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("cost &lt; 5 &amp; risk &gt; 0");
    expect(html).toContain("R&amp;D &lt;b&gt;");
  });

  it("falls back to a clear message when the packet has no sections", () => {
    const html = buildCanonicalDailyBriefPdfHtml({
      ...basePacket,
      sections: [],
      recommendedNextMoves: [],
    });

    expect(html).toContain("did not include rendered sections");
  });

  it("converts blank lines into separate paragraphs and single newlines into breaks", () => {
    const html = buildCanonicalDailyBriefPdfHtml({
      ...basePacket,
      sections: [{ title: "Notes", body: "Para one.\n\nPara two.\nSame paragraph." }],
    });

    expect(html).toContain("<p>Para one.</p>");
    expect(html).toContain("<p>Para two.<br>Same paragraph.</p>");
  });
});
