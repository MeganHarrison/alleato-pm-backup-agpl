import { parseGuideFrontmatter } from "../frontmatter";

describe("parseGuideFrontmatter", () => {
  it("splits a valid frontmatter block from the body and parses string/list fields", () => {
    const source = `---
slug: pm-handbook
title: PM Handbook
description: Core office-side skills for running a job.
roleIds:
  - project-engineer
  - project-manager
---

# Alleato Group — PM Handbook

Body content here.
`;
    const { frontmatter, body } = parseGuideFrontmatter(source);
    expect(frontmatter).toEqual({
      slug: "pm-handbook",
      title: "PM Handbook",
      description: "Core office-side skills for running a job.",
      roleIds: ["project-engineer", "project-manager"],
    });
    expect(body.trim().startsWith("# Alleato Group")).toBe(true);
  });

  it("throws a specific error when the frontmatter delimiters are missing", () => {
    expect(() => parseGuideFrontmatter("# No frontmatter here\n")).toThrow(/frontmatter/i);
  });

  it("throws a specific error naming the missing field when a required field is absent", () => {
    const source = `---
slug: pm-handbook
title: PM Handbook
---

Body.
`;
    expect(() => parseGuideFrontmatter(source)).toThrow(/description/i);
  });

  it("supports an empty roleIds list", () => {
    const source = `---
slug: alleato-pm-software-guide
title: Alleato PM Software
description: How to use the app.
roleIds: []
---

Body.
`;
    const { frontmatter } = parseGuideFrontmatter(source);
    expect(frontmatter.roleIds).toEqual([]);
  });

  it("strips matching surrounding quotes from a string value", () => {
    const source = `---
slug: pm-handbook
title: "PM Handbook: The Complete Guide"
description: 'Uses a colon: right there.'
roleIds:
  - project-manager
---

Body.
`;
    const { frontmatter } = parseGuideFrontmatter(source);
    expect(frontmatter.title).toBe("PM Handbook: The Complete Guide");
    expect(frontmatter.description).toBe("Uses a colon: right there.");
  });

  it("throws a specific error on a malformed frontmatter line instead of silently dropping it", () => {
    const source = `---
slug: pm-handbook
title: PM Handbook
description: A guide.
this line has no colon and is not a list item
---

Body.
`;
    expect(() => parseGuideFrontmatter(source)).toThrow(/malformed frontmatter line/i);
  });
});
