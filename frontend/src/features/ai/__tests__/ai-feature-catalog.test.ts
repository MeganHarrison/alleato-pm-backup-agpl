import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  aiFeatureCatalog,
  getAiFeature,
} from "@/features/ai/ai-feature-catalog";

describe("AI feature catalog", () => {
  it("uses one unique detail route for every catalog entry", () => {
    const ids = aiFeatureCatalog.map((feature) => feature.id);
    const hrefs = aiFeatureCatalog.map((feature) => feature.href);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    for (const feature of aiFeatureCatalog) {
      expect(feature.href).toBe(`/ai/features/${feature.id}`);
      expect(feature.launchHref).not.toBe(feature.href);
    }
  });

  it("includes the supplied cost allocation and WIP use case", () => {
    expect(getAiFeature("project-cost-allocation-wip")).toMatchObject({
      name: "Cost allocation & WIP analysis",
      title: "Project cost allocation & WIP analysis",
      launchHref: "/ai",
    });
  });

  it("fails closed for an unknown feature slug", () => {
    expect(getAiFeature("not-a-real-feature")).toBeUndefined();
  });

  it("backs every public feature URL with a static route file", () => {
    for (const feature of aiFeatureCatalog) {
      expect(
        existsSync(
          resolve(
            __dirname,
            "../../../app/(main)/ai/features",
            feature.id,
            "page.tsx",
          ),
        ),
      ).toBe(true);
    }

    expect(
      existsSync(
        resolve(
          __dirname,
          "../../../app/(main)/ai/features/[featureSlug]/page.tsx",
        ),
      ),
    ).toBe(false);
  });

  it("keeps every detail page complete enough to render all four sections", () => {
    for (const feature of aiFeatureCatalog) {
      expect(feature.challenge.points).toHaveLength(3);
      expect(feature.solution.points).toHaveLength(4);
      expect(feature.humansInTheLoop).toHaveLength(3);
      expect(feature.deployments).toHaveLength(3);
      expect(feature.process).toHaveLength(5);
      expect(feature.result.points).toHaveLength(3);
    }
  });

  it("keeps the feature table pointed at detail pages instead of live workflows", () => {
    const source = readFileSync(
      resolve(__dirname, "..", "ai-features-table-config.tsx"),
      "utf8",
    );

    expect(source).toContain("href={feature.href}");
    expect(source).toContain("aiFeatureCatalog");
  });
});
