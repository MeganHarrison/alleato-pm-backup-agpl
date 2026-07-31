export interface ProjectTeamRoleMemberPerson {
  id: string;
  auth_user_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name?: string | null;
  email?: string | null;
  phone_mobile?: string | null;
  phone_business?: string | null;
  company_name?: string | null;
}

export interface ProjectTeamRoleMember {
  id: string;
  person_id: string;
  assigned_at?: string | null;
  person: ProjectTeamRoleMemberPerson | null;
}

export interface ProjectTeamRole {
  id: string;
  role_name: string;
  role_type?: string | null;
  display_order?: number | null;
  members: ProjectTeamRoleMember[];
}

export interface PunchAssigneeOption {
  id: string;
  person_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  job_title: string | null;
  company_name: string | null;
  role_names: string[];
}

function displayName(person: ProjectTeamRoleMemberPerson): string {
  const explicitName = person.full_name?.trim();
  if (explicitName) return explicitName;

  const composedName = [person.first_name, person.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return composedName || person.email || "Unnamed contact";
}

export function flattenProjectTeamAssignees(
  roles: ProjectTeamRole[],
): PunchAssigneeOption[] {
  const peopleById = new Map<string, PunchAssigneeOption>();

  for (const role of roles) {
    for (const member of role.members ?? []) {
      if (!member.person) continue;
      // punch_items person fields reference auth.users, not people. Contacts
      // without an auth link cannot be valid assignees or approvers.
      if (!member.person.auth_user_id) continue;

      const existing = peopleById.get(member.person.id);
      if (existing) {
        if (!existing.role_names.includes(role.role_name)) {
          existing.role_names.push(role.role_name);
        }
        continue;
      }

      peopleById.set(member.person.id, {
        id: member.person.auth_user_id,
        person_id: member.person.id,
        first_name: member.person.first_name,
        last_name: member.person.last_name,
        full_name: displayName(member.person),
        email: member.person.email ?? null,
        job_title: role.role_name || null,
        company_name: member.person.company_name ?? null,
        role_names: role.role_name ? [role.role_name] : [],
      });
    }
  }

  return Array.from(peopleById.values()).sort((a, b) => {
    const companyCompare = (a.company_name ?? "").localeCompare(b.company_name ?? "");
    if (companyCompare !== 0) return companyCompare;
    return a.full_name.localeCompare(b.full_name);
  });
}
