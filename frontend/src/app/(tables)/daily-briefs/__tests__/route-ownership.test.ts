import fs from "node:fs";
import path from "node:path";

import {
  hasCompleteDailyBriefMarkdown,
  MISSING_DAILY_BRIEF_CONTENT,
} from "@/lib/daily-briefs/canonical-packets";

const detailRoute = path.join(
  process.cwd(),
  "src/app/(tables)/daily-briefs/[briefId]/page.tsx",
);
const landingRoute = path.join(process.cwd(), "src/app/daily-brief/page.tsx");
const canonicalPacketReader = path.join(
  process.cwd(),
  "src/lib/daily-briefs/canonical-packets.ts",
);
const packetApiAdapter = path.join(
  process.cwd(),
  "src/app/api/executive/daily-brief/route-helpers.ts",
);

describe("Daily Brief route ownership", () => {
  test("individual packet routes render the complete persisted report", () => {
    const source = fs.readFileSync(detailRoute, "utf8");

    expect(source).toContain("BriefMarkdown");
    expect(source).toContain("packet.briefMarkdown");
    expect(source).toContain("hasCompleteDailyBriefMarkdown");
    expect(source).not.toContain("ExecutiveBriefView");
    expect(source).not.toContain("buildExecutiveBriefViewModel");
    expect(source).not.toContain("intelligence-brief/brief.css");
  });

  test("the designed executive template remains owned by the landing route", () => {
    const source = fs.readFileSync(landingRoute, "utf8");

    expect(source).toContain("ExecutiveBriefView");
    expect(source).toContain("buildExecutiveBriefViewModel");
    expect(source).not.toContain("BriefMarkdown");
  });

  test("missing full report content fails the availability contract", () => {
    expect(hasCompleteDailyBriefMarkdown("")).toBe(false);
    expect(hasCompleteDailyBriefMarkdown("   ")).toBe(false);
    expect(hasCompleteDailyBriefMarkdown(MISSING_DAILY_BRIEF_CONTENT)).toBe(false);
    expect(hasCompleteDailyBriefMarkdown("# Daily Executive Brief\n\nFull report")).toBe(true);
  });

  test("canonical web adapters cannot write or regenerate Project Intelligence", () => {
    const reader = fs.readFileSync(canonicalPacketReader, "utf8");
    const api = fs.readFileSync(packetApiAdapter, "utf8");
    const canonicalSurfaces = `${reader}\n${api}`;

    expect(reader).toContain('.from("intelligence_packets")');
    expect(api).toContain("loadCurrentDailyExecutiveBriefPacket");
    expect(api).toContain("legacy_generation_retired");
    expect(canonicalSurfaces).not.toMatch(/\.from\("intelligence_packets"\)[\s\S]{0,240}\.(insert|update|upsert|delete)\(/);
  });
});
