import {
  normalizeTrainingRoleLabel,
  resolveViewerRole,
} from "../role-resolution";
import type { TrainingRole } from "../types";

const roles: TrainingRole[] = [
  {
    id: "role-project-manager",
    slug: "project-manager",
    name: "Project Manager",
    description: null,
    aliases: ["PM", "Project Management"],
    sortOrder: 1,
  },
  {
    id: "role-superintendent",
    slug: "superintendent",
    name: "Superintendent",
    description: null,
    aliases: ["Site Super"],
    sortOrder: 2,
  },
];

test("normalizes role labels consistently", () => {
  expect(normalizeTrainingRoleLabel("  Project & Field  ")).toBe(
    "project-and-field",
  );
});

test.each([
  ["Project Manager", "project-manager"],
  ["project-manager", "project-manager"],
  [" pm ", "project-manager"],
  ["SITE SUPER", "superintendent"],
])("resolves an exact unambiguous title %s", (title, expected) => {
  expect(resolveViewerRole(title, roles)).toBe(expected);
});

test("does not guess from a partial or missing title", () => {
  expect(resolveViewerRole("Project", roles)).toBeNull();
  expect(resolveViewerRole(null, roles)).toBeNull();
});

test("returns null when aliases make the match ambiguous", () => {
  const ambiguousRoles = [
    ...roles,
    {
      id: "role-program-manager",
      slug: "program-manager",
      name: "Program Manager",
      description: null,
      aliases: ["PM"],
      sortOrder: 3,
    },
  ];

  expect(resolveViewerRole("PM", ambiguousRoles)).toBeNull();
});
