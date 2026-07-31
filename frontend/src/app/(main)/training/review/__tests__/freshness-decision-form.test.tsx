/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { FreshnessDecisionForm } from "../freshness-decision-form";

jest.mock("../actions", () => ({
  decideTrainingFreshness: jest.fn(),
}));

test("requires reviewer feedback and offers explicit keep/archive decisions", () => {
  render(
    <FreshnessDecisionForm
      checkId="10eaaf47-e1fc-4867-8954-05911f10f298"
      recommendedAction="archive"
    />,
  );

  expect(screen.getByLabelText("Review note")).toBeRequired();
  expect(screen.getByLabelText("Review note")).toHaveAttribute("minLength", "8");
  expect(
    screen.getByRole("button", { name: "Keep resource" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Archive resource" }),
  ).toBeInTheDocument();
});
