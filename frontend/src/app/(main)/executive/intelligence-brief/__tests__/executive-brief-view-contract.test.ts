import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Daily Brief landing presentation contract", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "src/app/(main)/executive/intelligence-brief/executive-brief-view.tsx",
    ),
    "utf8",
  );

  it("renders the canonical persisted narrative instead of a decision-only summary", () => {
    expect(source).toContain("model.narrativeSections");
    expect(source).toContain("<BriefMarkdown content={section.body}");
    expect(source).toContain("assessment.body");
    expect(source).toContain("Open complete source brief");
  });

  it("keeps evidence-backed follow-through without repeating workflow boilerplate per decision", () => {
    expect(source).toContain("Assign follow-through");
    expect(source).toContain("decision.sourceRefs");
    expect(source).not.toContain(
      "Creates a governed attention item with the current brief’s immutable evidence",
    );
  });
});
