import type { PersonWithDetails } from "@/services/directoryService";
import { filterProjectMembers } from "./project-members";

/**
 * Creates a minimal person fixture for project member filtering tests.
 */
function makePerson(
  id: string,
  overrides: Partial<PersonWithDetails> = {},
): PersonWithDetails {
  return {
    id,
    first_name: "Test",
    last_name: "Person",
    email: `${id}@example.com`,
    person_type: "contact",
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as PersonWithDetails;
}

describe("filterProjectMembers", () => {
  it("keeps people with real project memberships", () => {
    const member = makePerson("member-1", {
      membership: {
        id: "membership-1",
        project_id: 889,
        person_id: "member-1",
        status: "active",
      } as PersonWithDetails["membership"],
    });

    expect(filterProjectMembers([member])).toEqual([member]);
  });

  it("drops raw company people that do not have a project membership", () => {
    const member = makePerson("member-1", {
      membership: {
        id: "membership-1",
        project_id: 889,
        person_id: "member-1",
        status: "active",
      } as PersonWithDetails["membership"],
    });
    const vendorRosterPerson = makePerson("person-2", {
      company: {
        id: "company-1",
        name: "Alleato Group",
      } as PersonWithDetails["company"],
    });

    expect(filterProjectMembers([member, vendorRosterPerson])).toEqual([member]);
  });

  it("deduplicates duplicate membership rows for the same person", () => {
    const member = makePerson("member-1", {
      membership: {
        id: "membership-1",
        project_id: 889,
        person_id: "member-1",
        status: "active",
      } as PersonWithDetails["membership"],
    });

    expect(filterProjectMembers([member, member])).toEqual([member]);
  });
});
