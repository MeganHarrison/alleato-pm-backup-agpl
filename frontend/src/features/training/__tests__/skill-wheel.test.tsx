/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { SkillWheel } from "../SkillWheel";

describe("SkillWheel", () => {
  it("keeps its accessible name outside document-title-sensitive SVG markup", () => {
    const { container } = render(
      <SkillWheel
        roleName="Project Engineer"
        scores={[
          {
            skillId: "skill-1",
            name: "Ownership",
            score: 40,
            target: 70,
            importance: 5,
            isCore: true,
          },
          {
            skillId: "skill-2",
            name: "Communication",
            score: 50,
            target: 80,
            importance: 4,
            isCore: false,
          },
        ]}
      />,
    );

    expect(container.querySelector("svg title")).not.toBeInTheDocument();
    expect(container.querySelector("svg desc")).not.toBeInTheDocument();
    expect(screen.getByTestId("skill-wheel")).toHaveAccessibleName(
      "Project Engineer Skill Wheel",
    );
    expect(screen.getByText(/Ownership: 40, target 70/)).toHaveClass("sr-only");
    for (const coordinate of container.querySelectorAll("line, text")) {
      for (const attribute of ["x", "y", "x1", "y1", "x2", "y2"]) {
        const value = coordinate.getAttribute(attribute);
        if (value) {
          expect(value).toMatch(/^-?\d+(?:\.\d)?$/);
        }
      }
    }
  });
});
