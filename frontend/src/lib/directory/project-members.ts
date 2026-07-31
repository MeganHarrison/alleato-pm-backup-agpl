import type { PersonWithDetails } from "@/services/directoryService";

/**
 * Returns only real project members so raw company rosters cannot leak into the project members UI.
 */
export function filterProjectMembers(
  people: PersonWithDetails[],
): PersonWithDetails[] {
  const seen = new Set<string>();
  const members: PersonWithDetails[] = [];

  for (const person of people) {
    if (!person.membership?.project_id) {
      continue;
    }

    if (seen.has(person.id)) {
      continue;
    }

    seen.add(person.id);
    members.push(person);
  }

  return members;
}
