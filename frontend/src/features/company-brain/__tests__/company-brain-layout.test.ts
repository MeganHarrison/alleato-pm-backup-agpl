import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(
  resolve(__dirname, "../company-brain.module.css"),
  "utf8",
);
const experience = readFileSync(
  resolve(__dirname, "../company-brain-experience.tsx"),
  "utf8",
);

describe("Company Brain graph overlay containment", () => {
  it("uses the shared dashboard header and keeps graph guidance outside the canvas", () => {
    expect(experience).toContain("WorkspacePageIntro");
    expect(experience).toContain("styles.contextLine");
    expect(experience).toContain("styles.searchRecovery");
    expect(experience).not.toContain("KnowledgeMetrics");
    expect(experience).not.toContain("styles.head");
    expect(styles).not.toMatch(/\.contextLine\s*\{[^}]*position:\s*absolute;/s);
    expect(styles).not.toMatch(/\.hint\s*\{[^}]*position:\s*absolute;/s);
  });
});
