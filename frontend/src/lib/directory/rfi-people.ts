import type { ProjectRole } from "@/hooks/use-project-roles";

export interface RfiPersonOption {
  value: string;
  label: string;
  keywords: string[];
}

/**
 * RFI Manager + Assignee options come from the project's **Project Team** — the
 * people assigned to project roles (Superintendent, PM, Architect, etc.), i.e.
 * exactly the roster shown on the Project Directory → Project Team tab.
 *
 * This is deliberately NARROWER than `project_directory_memberships` (the full
 * project roster). Client feedback (repeatedly): the RFI Manager / Assignee
 * pickers must list only the handful of people actually staffed on the project,
 * not everyone who has directory access. Scoping to `project_directory_memberships`
 * was the long-standing bug — that table held 27 people for a project whose
 * Project Team is 5.
 *
 * No `person_type` filter is applied: the Architect (and other external
 * consultants) are legitimately on the Project Team as `contact` records and
 * must remain selectable.
 *
 * Values are stored as the person's full name (RFI person columns are free
 * text and store names, not UUIDs — see `rfi_person_fields_store_names`).
 */
export function projectTeamToUserOptions(roles: ProjectRole[]): RfiPersonOption[] {
  const byName = new Map<string, RfiPersonOption>();
  const seenPersonIds = new Set<string>();

  for (const role of roles) {
    for (const member of role.members) {
      const person = member.person;
      if (!person) continue;
      if (seenPersonIds.has(person.id)) continue;
      seenPersonIds.add(person.id);

      const fullName = `${person.first_name?.trim() || ""} ${person.last_name?.trim() || ""}`.trim();
      if (!fullName) continue;

      const key = fullName.toLowerCase();
      if (byName.has(key)) continue;

      byName.set(key, {
        value: fullName,
        label: fullName,
        keywords: [person.email || "", person.company_name || ""].filter(Boolean),
      });
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.label.localeCompare(b.label));
}
