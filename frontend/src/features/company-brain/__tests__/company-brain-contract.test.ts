import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isBrainFocus, parseBrainRange } from "../company-brain-contract";
import { buildCompanyBrainFixture } from "../company-brain-fixture";

describe("Company Brain contract", () => {
  it("normalizes range and focus query values", () => {
    expect(parseBrainRange("7d")).toBe("7d");
    expect(parseBrainRange("invalid")).toBe("24h");
    expect(parseBrainRange(["30d", "7d"])).toBe("30d");
    expect(isBrainFocus("source:sharepoint")).toBe(true);
    expect(isBrainFocus("source:share point")).toBe(false);
    expect(isBrainFocus("unknown:secret")).toBe(false);
  });

  it("keeps deterministic fixture positions and valid relationships", () => {
    const first = buildCompanyBrainFixture("ready");
    const second = buildCompanyBrainFixture("ready");
    expect(first).toEqual(second);

    const ids = new Set(first.nodes.map((node) => node.id));
    expect(ids.size).toBe(first.nodes.length);
    first.edges.forEach((edge) => {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    });
    first.nodes.forEach((node) => {
      expect(node.layout.x).toBeGreaterThanOrEqual(0);
      expect(node.layout.x).toBeLessThanOrEqual(100);
      expect(node.layout.y).toBeGreaterThanOrEqual(0);
      expect(node.layout.y).toBeLessThanOrEqual(100);
    });
  });

  it("removes permission-limited entities before serialization", () => {
    const overview = buildCompanyBrainFixture("permission_limited");
    const serialized = JSON.stringify(overview);
    expect(overview.permissionLimited).toBe(true);
    expect(serialized).not.toContain("SharePoint");
    expect(serialized).not.toContain("change-detection");
    expect(serialized).not.toContain('"count":253');
    expect(
      overview.edges.every(
        (edge) =>
          overview.nodes.some((node) => node.id === edge.from) &&
          overview.nodes.some((node) => node.id === edge.to),
      ),
    ).toBe(true);
  });

  it.each(["empty", "partial", "error", "permission_limited"] as const)(
    "has a deterministic %s state",
    (state) => {
      expect(buildCompanyBrainFixture(state).state).toBe(state);
    },
  );
});

describe("Company Brain delivery guardrails", () => {
  const experience = readFileSync(
    resolve(__dirname, "../company-brain-experience.tsx"),
    "utf8",
  );
  const styles = readFileSync(
    resolve(__dirname, "../company-brain.module.css"),
    "utf8",
  );
  const telemetry = readFileSync(
    resolve(__dirname, "../company-brain-telemetry.ts"),
    "utf8",
  );

  it("ships SVG plus a textual map and a mobile map, without canvas", () => {
    expect(experience).toContain("<svg");
    expect(experience).toContain('data-testid="company-brain-text-map"');
    expect(experience).toContain('data-testid="company-brain-mobile-story"');
    expect(experience).not.toContain("<canvas");
    expect(experience).not.toContain("Math.random");
    expect(experience).not.toContain('node.id === "catalog"');
  });

  /**
   * Mobile renders the same diagram rotated, not a degraded list — the brain
   * and its animated lanes are the page, so they must survive the breakpoint.
   */
  it("keeps the brain and animated lanes in the mobile map", () => {
    expect(experience).toContain("function MobileMap");
    expect(experience).toContain("<BrainButton");
    expect(experience).toContain("styles.mobileFlowLines");
    expect(experience).not.toContain("function MobileStory");
    expect(styles).toContain(".mobileBrainStage .brainButton");
    expect(styles).toMatch(
      /\.mobileFlowLines path[\s\S]*animation:\s*dataFlow/,
    );
  });

  it("switches to story mode below 768px and stops motion when requested", () => {
    expect(styles).toContain("@media (max-width: 47.999rem)");
    expect(styles).toContain("@media (min-width: 48rem)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/prefers-reduced-motion[\s\S]*animation:\s*none/);
  });

  it("keeps telemetry enum-only", () => {
    expect(telemetry).toContain("Privacy boundary");
    expect(telemetry).not.toMatch(
      /properties:\s*\{[^}]*\b(name|id|count|query|timestamp)\b/s,
    );
  });
});
