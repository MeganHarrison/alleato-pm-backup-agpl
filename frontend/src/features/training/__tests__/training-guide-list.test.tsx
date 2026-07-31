/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { TrainingGuideList } from "../TrainingGuideList";
import { fixtureGuide } from "../__fixtures__/training-fixtures";

describe("TrainingGuideList", () => {
  it("links each guide to its canonical in-app route", () => {
    render(
      <TrainingGuideList
        guides={[
          fixtureGuide,
          {
            ...fixtureGuide,
            slug: "superintendent-handbook",
            title: "Superintendent Handbook",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /PM Handbook/i }),
    ).toHaveAttribute("href", "/training/guides/pm-handbook");
    expect(
      screen.getByRole("link", { name: /Superintendent Handbook/i }),
    ).toHaveAttribute("href", "/training/guides/superintendent-handbook");
  });
});
