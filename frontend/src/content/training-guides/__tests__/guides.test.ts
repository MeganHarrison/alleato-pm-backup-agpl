import { readdirSync, readFileSync } from "fs";
import path from "path";

import { parseGuideFrontmatter } from "../frontmatter";

const GUIDES_DIR = path.join(__dirname, "..");
const KNOWN_ROLE_SLUGS = [
  "project-engineer",
  "assistant-project-manager",
  "project-manager",
  "estimator",
  "assistant-superintendent",
  "superintendent",
];

function guideFiles(): string[] {
  return readdirSync(GUIDES_DIR).filter((file) => file.endsWith(".mdx"));
}

describe("training guide MDX files", () => {
  it("has exactly the four expected guides", () => {
    expect(guideFiles().sort()).toEqual([
      "alleato-pm-software-guide.mdx",
      "manager-coaching-guide.mdx",
      "pm-handbook.mdx",
      "superintendent-handbook.mdx",
    ]);
  });

  it.each(guideFiles())("%s has valid frontmatter, a slug matching its filename, only known role slugs, and a non-empty body", (file) => {
    const source = readFileSync(path.join(GUIDES_DIR, file), "utf8");
    const { frontmatter, body } = parseGuideFrontmatter(source);

    expect(frontmatter.slug).toBe(file.replace(/\.mdx$/, ""));
    expect(frontmatter.title.length).toBeGreaterThan(0);
    expect(frontmatter.description.length).toBeGreaterThan(0);
    expect(frontmatter.roleIds.length).toBeGreaterThan(0);
    for (const roleId of frontmatter.roleIds) {
      expect(KNOWN_ROLE_SLUGS).toContain(roleId);
    }
    expect(body.trim().length).toBeGreaterThan(500);
    expect(body).not.toMatch(/procore/i);
  });

  it.each(guideFiles())("%s body contains no MDX-breaking JSX-like syntax (these are prose docs, not components)", (file) => {
    const source = readFileSync(path.join(GUIDES_DIR, file), "utf8");
    const { body } = parseGuideFrontmatter(source);

    expect(body).not.toMatch(/<[A-Za-z]/);
    expect(body).not.toMatch(/\{[^}]*\}/);
  });
});
