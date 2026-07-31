import {
  buildUserSlugMaps,
  getProjectRoleTemplates,
  looksLikePersonId,
  slugifyName,
  toAccessSummary,
  type PermissionUser,
} from "../user-access-data";
import type { PermissionTemplate } from "@/lib/permissions-shared";

function template(
  id: string,
  name: string,
  scope: PermissionTemplate["scope"],
): PermissionTemplate {
  return {
    id,
    name,
    scope,
    description: undefined,
    rules_json: {
      directory: ["read"],
      budget: ["read"],
      contracts: ["read"],
      documents: ["read"],
      schedule: ["read"],
      submittals: ["read"],
      rfis: ["read"],
      change_orders: ["read"],
    },
    granular_flags: [],
    is_system: true,
  };
}

describe("getProjectRoleTemplates", () => {
  it("removes company templates from project-role dropdown options", () => {
    const templates = [
      template("company-pm", "Project Manager", "company"),
      template("project-pm", "Project Manager", "project"),
      template("project-admin", "Project Admin", "project"),
    ];

    expect(getProjectRoleTemplates(templates).map((item) => item.id)).toEqual([
      "project-pm",
      "project-admin",
    ]);
  });

  it("dedupes visually identical project template names", () => {
    const templates = [
      template("pm-1", "Project Manager", "project"),
      template("pm-2", "  Project   Manager  ", "project"),
      template("super", "Superintendent", "project"),
    ];

    expect(getProjectRoleTemplates(templates).map((item) => item.id)).toEqual([
      "pm-1",
      "super",
    ]);
  });
});

function permissionUser(overrides: Partial<PermissionUser> = {}): PermissionUser {
  return {
    personId: "person-1",
    authUserId: "auth-1",
    firstName: "Megan",
    lastName: "Harrison",
    email: "megan@example.com",
    personType: "employee",
    profilePhotoUrl: null,
    isAdmin: true,
    companyTemplateId: null,
    companyTemplateName: null,
    teamsAccount: null,
    memberships: [],
    granularOverrides: [],
    ...overrides,
  };
}

describe("toAccessSummary", () => {
  it("preserves linked Teams account details", () => {
    const summary = toAccessSummary(
      permissionUser({
        teamsAccount: {
          platformUserId: "29:teams-user",
          displayName: "Megan Harrison",
          linkedAt: "2026-06-25T16:00:00.000Z",
        },
      }),
    );

    expect(summary.teamsAccount).toEqual({
      platformUserId: "29:teams-user",
      displayName: "Megan Harrison",
      linkedAt: "2026-06-25T16:00:00.000Z",
    });
  });

  it("keeps unlinked Teams account state explicit", () => {
    const summary = toAccessSummary(permissionUser({ teamsAccount: null }));

    expect(summary.teamsAccount).toBeNull();
  });

  it("preserves the raw Supabase person type", () => {
    const summary = toAccessSummary(permissionUser({ personType: "subcontractor" }));

    expect(summary.personType).toBe("subcontractor");
  });
});

describe("slugifyName", () => {
  it("kebab-cases a normal name", () => {
    expect(slugifyName("John Smith")).toBe("john-smith");
  });

  it("strips accents and apostrophes", () => {
    expect(slugifyName("José O'Brien")).toBe("jose-obrien");
  });

  it("collapses punctuation and trims stray hyphens", () => {
    expect(slugifyName("  Mary-Jane  (PM) ")).toBe("mary-jane-pm");
  });

  it("falls back to 'user' when nothing slugifiable remains", () => {
    expect(slugifyName("！！！")).toBe("user");
  });

  it("falls back to 'user' on empty string", () => {
    expect(slugifyName("")).toBe("user");
  });

  it("falls back to 'user' on whitespace-only string", () => {
    expect(slugifyName("   ")).toBe("user");
  });
});

describe("looksLikePersonId", () => {
  it("recognises a UUID", () => {
    expect(looksLikePersonId("a2a3eaf6-b0bf-46de-b406-493289136877")).toBe(true);
  });

  it("rejects a name slug", () => {
    expect(looksLikePersonId("john-smith-2")).toBe(false);
  });
});

describe("buildUserSlugMaps", () => {
  function summaryFor(personId: string, fullName: string) {
    return toAccessSummary(
      permissionUser({
        personId,
        firstName: fullName.split(" ")[0] ?? "",
        lastName: fullName.split(" ").slice(1).join(" "),
        email: `${personId}@example.com`,
      }),
    );
  }

  it("gives unique names a bare slug", () => {
    const { slugByPersonId } = buildUserSlugMaps([
      summaryFor("p1", "John Smith"),
      summaryFor("p2", "Jane Doe"),
    ]);

    expect(slugByPersonId.get("p1")).toBe("john-smith");
    expect(slugByPersonId.get("p2")).toBe("jane-doe");
  });

  it("numbers duplicate names starting at the second occurrence", () => {
    const { slugByPersonId } = buildUserSlugMaps([
      summaryFor("p-aaa", "John Smith"),
      summaryFor("p-bbb", "John Smith"),
      summaryFor("p-ccc", "John Smith"),
    ]);

    expect(slugByPersonId.get("p-aaa")).toBe("john-smith");
    expect(slugByPersonId.get("p-bbb")).toBe("john-smith-2");
    expect(slugByPersonId.get("p-ccc")).toBe("john-smith-3");
  });

  it("numbers duplicates deterministically regardless of input order", () => {
    const ordered = buildUserSlugMaps([
      summaryFor("p-aaa", "John Smith"),
      summaryFor("p-bbb", "John Smith"),
    ]).slugByPersonId;
    const reversed = buildUserSlugMaps([
      summaryFor("p-bbb", "John Smith"),
      summaryFor("p-aaa", "John Smith"),
    ]).slugByPersonId;

    expect(ordered.get("p-aaa")).toBe(reversed.get("p-aaa"));
    expect(ordered.get("p-bbb")).toBe(reversed.get("p-bbb"));
  });

  it("round-trips slug back to personId", () => {
    const { slugByPersonId, personIdBySlug } = buildUserSlugMaps([
      summaryFor("p1", "John Smith"),
      summaryFor("p2", "John Smith"),
    ]);

    for (const [personId, slug] of slugByPersonId) {
      expect(personIdBySlug.get(slug)).toBe(personId);
    }
  });

  it("handles an empty user list without error", () => {
    const { slugByPersonId, personIdBySlug } = buildUserSlugMaps([]);
    expect(slugByPersonId.size).toBe(0);
    expect(personIdBySlug.size).toBe(0);
  });

  it("does not collide when a user's natural slug matches a generated suffix", () => {
    // "John Smith 2" naturally slugifies to "john-smith-2". Without a collision
    // guard, a second "John Smith" duplicate would overwrite its reverse-map entry.
    const { slugByPersonId, personIdBySlug } = buildUserSlugMaps([
      summaryFor("p-aaa", "John Smith"),
      summaryFor("p-bbb", "John Smith 2"),
      summaryFor("p-ccc", "John Smith"),
    ]);

    const aaaSlug = slugByPersonId.get("p-aaa")!;
    const bbbSlug = slugByPersonId.get("p-bbb")!;
    const cccSlug = slugByPersonId.get("p-ccc")!;

    // All three slugs must be distinct.
    expect(new Set([aaaSlug, bbbSlug, cccSlug]).size).toBe(3);

    // Reverse map must resolve correctly for every user.
    expect(personIdBySlug.get(aaaSlug)).toBe("p-aaa");
    expect(personIdBySlug.get(bbbSlug)).toBe("p-bbb");
    expect(personIdBySlug.get(cccSlug)).toBe("p-ccc");
  });

  it("treats accent-stripped names as duplicates of their ASCII equivalent", () => {
    // "José Smith" and "Jose Smith" both slugify to "jose-smith".
    // The second (higher personId) should get the "-2" suffix.
    const { slugByPersonId } = buildUserSlugMaps([
      summaryFor("p-aaa", "Jose Smith"),
      summaryFor("p-bbb", "José Smith"),
    ]);

    expect(slugByPersonId.get("p-aaa")).toBe("jose-smith");
    expect(slugByPersonId.get("p-bbb")).toBe("jose-smith-2");
  });
});
