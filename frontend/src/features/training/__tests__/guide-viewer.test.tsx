/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { GuideViewer } from "../GuideViewer";
import { fixtureGuide } from "../__fixtures__/training-fixtures";

describe("GuideViewer", () => {
  it("renders the guide title, description, and whatever content node it is handed", () => {
    render(
      <GuideViewer
        guide={fixtureGuide}
        content={
          <p data-testid="guide-body">
            Step one: kickoff. Step two: budget setup.
          </p>
        }
      />,
    );

    expect(screen.getByText(fixtureGuide.title)).toBeInTheDocument();
    expect(screen.getByText(fixtureGuide.description)).toBeInTheDocument();
    expect(screen.getByTestId("guide-body")).toHaveTextContent("Step one: kickoff. Step two: budget setup.");
    expect(screen.getByTestId("training-guide-reader").tagName).toBe("ARTICLE");
    expect(screen.getByTestId("training-guide-content")).toContainElement(screen.getByTestId("guide-body"));
  });

  it("stays pure — it does not compile MDX itself, so unrelated content renders unmodified", () => {
    render(<GuideViewer guide={fixtureGuide} content={<div data-testid="raw">{"# Not compiled by GuideViewer"}</div>} />);
    expect(screen.getByTestId("raw")).toHaveTextContent("# Not compiled by GuideViewer");
  });
});
