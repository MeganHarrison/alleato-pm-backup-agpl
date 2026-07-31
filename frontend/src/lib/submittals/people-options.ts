import type { AuthUser } from "@/hooks/use-auth-users";
import type { CompanyContact } from "@/hooks/use-company-contacts";

type PickerOption = {
  value: string;
  label: string;
  keywords?: string[];
};

function personLabel(person: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}): string {
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name || person.email || "Unnamed Contact";
}

export function isAlleatoEmployee(user: AuthUser): boolean {
  const companyName = (user.company_name ?? "").trim().toLowerCase();
  const isAlleato = companyName === "alleato group" || companyName.startsWith("alleato group ");
  const isEmployee = user.person_type === "employee" || user.person_type === "user";
  const isActive = user.status == null || user.status === "active";
  return isAlleato && isEmployee && isActive;
}

export function isCompanyContact(contact: CompanyContact): boolean {
  return contact.person_type == null || contact.person_type === "contact";
}

export function buildAuthUserOptions(users: AuthUser[]): PickerOption[] {
  return users.map((user) => ({
    value: user.id,
    label: personLabel(user),
    keywords: [user.email].filter(Boolean) as string[],
  }));
}

export function buildCompanyContactOptions(contacts: CompanyContact[]): PickerOption[] {
  return contacts.map((contact) => ({
    value: contact.id,
    label: personLabel(contact),
    keywords: [contact.email].filter(Boolean) as string[],
  }));
}
