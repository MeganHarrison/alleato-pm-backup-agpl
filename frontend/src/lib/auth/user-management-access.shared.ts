export const USER_MANAGEMENT_ROLE_TITLES = [
  "Senior Project Manager",
  "Project Manager",
  "Superintendent",
] as const;

const USER_MANAGEMENT_ROLE_KEYS = new Set(
  USER_MANAGEMENT_ROLE_TITLES.map((role) => normalizeRoleLabel(role)),
);

export type UserManagementAccessProfile = {
  isAdmin?: boolean | null;
  isDeveloper?: boolean | null;
  role?: string | null;
  title?: string | null;
  userType?: string | null;
};

export function normalizeRoleLabel(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function hasUserManagementRole(profile: UserManagementAccessProfile) {
  return [profile.role, profile.title, profile.userType].some((value) =>
    USER_MANAGEMENT_ROLE_KEYS.has(normalizeRoleLabel(value)),
  );
}

export function canAccessUserManagement(profile: UserManagementAccessProfile) {
  return (
    profile.isAdmin === true ||
    profile.isDeveloper === true ||
    normalizeRoleLabel(profile.userType) === "developer" ||
    hasUserManagementRole(profile)
  );
}
