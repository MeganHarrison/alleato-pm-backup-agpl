import { flattenProjectTeamAssignees } from "../project-team-assignee-options";

describe("flattenProjectTeamAssignees", () => {
  it("uses only contacts assigned to Project Team roles and keeps company context", () => {
    const assignees = flattenProjectTeamAssignees([
      {
        id: "role-super",
        role_name: "Superintendent",
        members: [
          {
            id: "member-1",
            person_id: "person-1",
            person: {
              id: "person-1",
              auth_user_id: "auth-user-1",
              first_name: "Colin",
              last_name: "Gillespie",
              full_name: "Colin Gillespie",
              email: "cgillespie@example.com",
              company_name: "Alleato",
            },
          },
        ],
      },
      {
        id: "role-owner",
        role_name: "Owner Contact",
        members: [
          {
            id: "member-2",
            person_id: "person-2",
            person: {
              id: "person-2",
              auth_user_id: "auth-user-2",
              first_name: "Alex",
              last_name: "Owner",
              email: "alex@example.com",
              company_name: "Client Co",
            },
          },
          {
            id: "member-3",
            person_id: "person-1",
            person: {
              id: "person-1",
              auth_user_id: "auth-user-1",
              first_name: "Colin",
              last_name: "Gillespie",
              email: "cgillespie@example.com",
              company_name: "Alleato",
            },
          },
        ],
      },
    ]);

    expect(assignees).toEqual([
      {
        id: "auth-user-1",
        person_id: "person-1",
        first_name: "Colin",
        last_name: "Gillespie",
        full_name: "Colin Gillespie",
        email: "cgillespie@example.com",
        job_title: "Superintendent",
        company_name: "Alleato",
        role_names: ["Superintendent", "Owner Contact"],
      },
      {
        id: "auth-user-2",
        person_id: "person-2",
        first_name: "Alex",
        last_name: "Owner",
        full_name: "Alex Owner",
        email: "alex@example.com",
        job_title: "Owner Contact",
        company_name: "Client Co",
        role_names: ["Owner Contact"],
      },
    ]);
  });

  it("falls back to email when imported names are blank", () => {
    const assignees = flattenProjectTeamAssignees([
      {
        id: "role-architect",
        role_name: "Architect",
        members: [
          {
            id: "member-1",
            person_id: "person-1",
            person: {
              id: "person-1",
              auth_user_id: "auth-user-1",
              first_name: null,
              last_name: null,
              email: "architect@example.com",
              company_name: null,
            },
          },
        ],
      },
    ]);

    expect(assignees[0]?.full_name).toBe("architect@example.com");
  });

  it("excludes project contacts without an auth user link", () => {
    expect(
      flattenProjectTeamAssignees([
        {
          id: "role-1",
          role_name: "Subcontractor",
          members: [
            {
              id: "member-1",
              person_id: "person-1",
              person: {
                id: "person-1",
                auth_user_id: null,
                first_name: "Unlinked",
                last_name: "Contact",
                email: "unlinked@example.com",
                company_name: "Vendor",
              },
            },
          ],
        },
      ]),
    ).toEqual([]);
  });
});
