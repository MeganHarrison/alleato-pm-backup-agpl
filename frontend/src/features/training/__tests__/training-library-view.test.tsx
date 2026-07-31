/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

import type { LearningLibraryItem } from "@/lib/learning/types";

import { TrainingLibraryView } from "../TrainingLibraryView";

const roles = [
  { id: "role-pm", slug: "project-manager", name: "Project Manager" },
  { id: "role-field", slug: "superintendent", name: "Superintendent" },
];

function item(
  overrides: Partial<LearningLibraryItem> & Pick<LearningLibraryItem, "id" | "title" | "kind">,
): LearningLibraryItem {
  return {
    id: overrides.id,
    slug: overrides.id,
    title: overrides.title,
    summary: null,
    kind: overrides.kind,
    lifecycle: "published",
    visibility: "employees",
    sourceType: "native_content",
    sourceId: overrides.id,
    sourceUrl: null,
    href: `/training/content/${overrides.id}`,
    external: false,
    ownerName: null,
    reviewerName: null,
    updatedAt: "2026-07-30T12:00:00Z",
    publishedAt: "2026-07-30T12:00:00Z",
    topics: [],
    roles: [],
    skills: [],
    businessAreas: [],
    courseId: null,
    courseOutcome: null,
    courseDifficulty: null,
    estimatedMinutes: null,
    isInternalCourse: false,
    provider: null,
    ...overrides,
  };
}

const items = [
  item({
    id: "orientation",
    title: "Alleato PM Software Orientation",
    kind: "internal_course",
    sourceType: "learning_course",
    href: "/training/courses/alleato-pm-software-orientation",
    courseId: "course-1",
    isInternalCourse: true,
    estimatedMinutes: 45,
    roles: [roles[0]],
  }),
  item({
    id: "daily-log",
    title: "Superintendent Daily Log Guide",
    kind: "software_guide",
    summary: "Create a complete daily log.",
    roles: [roles[1]],
    topics: [{ id: "field", slug: "field", name: "Field Operations" }],
  }),
  item({
    id: "osha",
    title: "OSHA Safety Course",
    kind: "external_course",
    sourceType: "training_resource",
    sourceUrl: "https://example.com/osha",
    href: "https://example.com/osha",
    external: true,
    provider: "OSHA",
  }),
];

describe("TrainingLibraryView", () => {
  it("renders courses, guides, and external resources from one catalog", () => {
    render(<TrainingLibraryView items={items} roles={roles} />);

    expect(screen.getByText("Alleato PM Software Orientation")).toBeInTheDocument();
    expect(screen.getByText("Superintendent Daily Log Guide")).toBeInTheDocument();
    expect(screen.getByText("OSHA Safety Course")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Alleato PM Software Orientation/i }),
    ).toHaveAttribute("href", "/training/courses/alleato-pm-software-orientation");
    expect(
      screen.getByRole("link", { name: /OSHA Safety Course/i }),
    ).toHaveAttribute("target", "_blank");
  });

  it("filters by role and content type", () => {
    render(<TrainingLibraryView items={items} roles={roles} />);

    fireEvent.change(screen.getByLabelText("Filter by role"), {
      target: { value: "role-field" },
    });
    expect(screen.getByText("Superintendent Daily Log Guide")).toBeInTheDocument();
    expect(screen.queryByText("Alleato PM Software Orientation")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by role"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("Filter by content type"), {
      target: { value: "internal_course" },
    });
    expect(screen.getByText("Alleato PM Software Orientation")).toBeInTheDocument();
    expect(screen.queryByText("OSHA Safety Course")).not.toBeInTheDocument();
  });

  it("searches title, summary, provider, and taxonomy", () => {
    render(<TrainingLibraryView items={items} roles={roles} />);
    const search = screen.getByPlaceholderText(
      "Search guides, courses, SOPs, and resources...",
    );

    fireEvent.change(search, { target: { value: "field operations" } });
    expect(screen.getByText("Superintendent Daily Log Guide")).toBeInTheDocument();
    expect(screen.queryByText("OSHA Safety Course")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "osha" } });
    expect(screen.getByText("OSHA Safety Course")).toBeInTheDocument();
  });

  it("fails visibly when no content matches", () => {
    render(<TrainingLibraryView items={items} roles={roles} />);
    fireEvent.change(
      screen.getByPlaceholderText("Search guides, courses, SOPs, and resources..."),
      { target: { value: "no such training" } },
    );
    expect(screen.getByText("No training matches")).toBeInTheDocument();
  });
});
