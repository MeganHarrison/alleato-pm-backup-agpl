/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";

import { Heading } from "../heading";

describe("Heading", () => {
  it("renders the semantic element from `as`, falling back to `level`", () => {
    const { rerender } = render(<Heading level={3}>Sources</Heading>);
    expect(screen.getByRole("heading", { name: "Sources" }).tagName).toBe("H3");

    rerender(
      <Heading level={3} as="h2">
        Sources
      </Heading>,
    );
    expect(screen.getByRole("heading", { name: "Sources" }).tagName).toBe("H2");
  });

  /**
   * Guardrail: `id` used to be swallowed, so every
   * `aria-labelledby="<heading id>"` in the app pointed at nothing and the
   * labelled section had no accessible name.
   */
  it("forwards `id` so aria-labelledby can resolve to it", () => {
    render(
      <section aria-labelledby="activity-feed-title">
        <Heading level={3} as="h2" id="activity-feed-title">
          Live activity feed
        </Heading>
      </section>,
    );

    expect(
      screen.getByRole("heading", { name: "Live activity feed" }),
    ).toHaveAttribute("id", "activity-feed-title");
    expect(
      screen.getByRole("region", { name: "Live activity feed" }),
    ).toBeInTheDocument();
  });
});
