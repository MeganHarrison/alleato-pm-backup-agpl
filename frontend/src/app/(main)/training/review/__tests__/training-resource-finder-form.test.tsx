/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { TrainingResourceFinderForm } from "../training-resource-finder-form";

jest.mock("../finder-action", () => ({
  findTrainingResources: jest.fn(),
}));

const roles = [
  {
    id: "role-1",
    slug: "project-manager",
    name: "Project Manager",
    description: null,
    aliases: [],
    sortOrder: 1,
  },
];

const topics = [
  {
    id: "topic-1",
    slug: "change-management",
    name: "Change Management",
    description: null,
    sortOrder: 1,
  },
];

describe("TrainingResourceFinderForm", () => {
  it("serializes the selected role and topic for the server action", () => {
    render(<TrainingResourceFinderForm roles={roles} topics={topics} />);

    const form = screen
      .getByRole("button", { name: "Find resources" })
      .closest("form");
    expect(form).not.toBeNull();
    expect(Object.fromEntries(new FormData(form!))).toMatchObject({
      roleSlug: "project-manager",
      topicSlug: "change-management",
    });
  });

  it("fails visibly when role or topic configuration is unavailable", () => {
    render(<TrainingResourceFinderForm roles={[]} topics={topics} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "active training roles or topics could not be loaded",
    );
    expect(
      screen.queryByRole("button", { name: "Find resources" }),
    ).not.toBeInTheDocument();
  });
});
