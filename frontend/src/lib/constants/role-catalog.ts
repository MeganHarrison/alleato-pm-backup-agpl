// Standard construction project roles. Used by the Project Team picker as a
// normalized source — new roles should be added here so cross-project
// reporting and AI lookups stay clean. Custom roles can still be created via
// the picker's "Add custom role" escape hatch.

export interface CatalogRole {
  name: string;
  category: RoleCategory;
}

export type RoleCategory =
  | "Leadership"
  | "Project Leadership"
  | "Field"
  | "Estimating"
  | "Design"
  | "Owner";

export const ROLE_CATALOG: CatalogRole[] = [
  { name: "CEO", category: "Leadership" },
  { name: "Vice President", category: "Leadership" },

  { name: "Senior Project Manager", category: "Project Leadership" },
  { name: "Project Manager", category: "Project Leadership" },
  { name: "Assistant Project Manager", category: "Project Leadership" },

  { name: "Superintendent", category: "Field" },
  { name: "Foreman", category: "Field" },
  { name: "Field Engineer", category: "Field" },
  { name: "Safety Manager", category: "Field" },

  { name: "Estimator", category: "Estimating" },
  { name: "Project Engineer", category: "Estimating" },

  { name: "Architect", category: "Design" },
  { name: "Civil Engineer", category: "Design" },
  { name: "Structural Engineer", category: "Design" },
  { name: "MEP Engineer", category: "Design" },
  { name: "Geotechnical Engineer", category: "Design" },
  { name: "Landscape Architect", category: "Design" },

  { name: "Owner Representative", category: "Owner" },
  { name: "Inspector", category: "Owner" },
];

export const ROLE_CATEGORY_ORDER: RoleCategory[] = [
  "Project Leadership",
  "Field",
  "Estimating",
  "Design",
  "Owner",
  "Leadership",
];

export function isCatalogRole(name: string): boolean {
  return ROLE_CATALOG.some((r) => r.name.toLowerCase() === name.toLowerCase());
}
