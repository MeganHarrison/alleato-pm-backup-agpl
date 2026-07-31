import { projectTeamToUserOptions } from "@/lib/directory/rfi-people";
import type { ProjectRole } from "@/hooks/use-project-roles";

function member(
  id: string,
  first: string,
  last: string,
  extra: Partial<ProjectRole["members"][0]["person"]> = {},
): ProjectRole["members"][0] {
  return {
    id: `m-${id}`,
    person_id: id,
    assigned_at: "2026-01-01",
    person: {
      id,
      first_name: first,
      last_name: last,
      full_name: `${first} ${last}`,
      email: `${first.toLowerCase()}@example.com`,
      phone_mobile: null,
      phone_business: null,
      company_name: null,
      ...extra,
    },
  };
}

function role(id: string, name: string, members: ProjectRole["members"]): ProjectRole {
  return { id, role_name: name, role_type: "custom", display_order: 0, members };
}

describe("projectTeamToUserOptions", () => {
  it("returns only the project team members (not the full roster)", () => {
    const roles = [
      role("r1", "Superintendent", [member("p1", "Parker", "Hollingsworth")]),
      role("r2", "Senior Project Manager", [member("p2", "Bob", "Wright")]),
    ];
    const options = projectTeamToUserOptions(roles);
    expect(options.map((o) => o.value)).toEqual(["Bob Wright", "Parker Hollingsworth"]);
  });

  it("includes external consultants (contacts) — no person_type filter", () => {
    const roles = [
      role("r1", "Architect", [
        member("p1", "Jerome", "Daksiewicz", { company_name: "DkGr, LLC" }),
      ]),
    ];
    const options = projectTeamToUserOptions(roles);
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe("Jerome Daksiewicz");
    expect(options[0].keywords).toContain("DkGr, LLC");
  });

  it("dedupes a person assigned to multiple roles", () => {
    const roles = [
      role("r1", "PM", [member("p1", "Bob", "Wright")]),
      role("r2", "Estimator", [member("p1", "Bob", "Wright")]),
    ];
    const options = projectTeamToUserOptions(roles);
    expect(options).toHaveLength(1);
  });

  it("skips role slots with no assigned person", () => {
    const roles = [
      { id: "r1", role_name: "Vacant", role_type: "custom", display_order: 0, members: [] },
    ] as ProjectRole[];
    expect(projectTeamToUserOptions(roles)).toEqual([]);
  });

  it("returns an empty list when the project has no team", () => {
    expect(projectTeamToUserOptions([])).toEqual([]);
  });
});
