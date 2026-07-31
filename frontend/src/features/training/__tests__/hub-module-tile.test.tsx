/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { HubModuleTile } from "../HubModuleTile";

describe("HubModuleTile", () => {
  it("renders the tag, title, description, and a working primary link", () => {
    render(
      <HubModuleTile
        tag="PM TRACK"
        title="Running a Project — PM / PE"
        description="Everything the office side needs to run a job."
        primaryLink={{
          label: "PM Handbook",
          href: "/training/guides/pm-handbook",
        }}
        secondaryLink={{ label: "Resource Library", href: "/training/library" }}
      />,
    );

    expect(screen.getByText("PM TRACK")).toBeInTheDocument();
    expect(screen.getByText("Running a Project — PM / PE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /PM Handbook/ })).toHaveAttribute(
      "href",
      "/training/guides/pm-handbook",
    );
    expect(
      screen.getByRole("link", { name: /Resource Library/ }),
    ).toHaveAttribute("href", "/training/library");
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
  });

  it("replaces low-signal numbered module labels with a useful learning-path label", () => {
    render(
      <HubModuleTile
        tag="MODULE 1"
        title="The Method"
        description="Start here."
        primaryLink={{ label: "Read the method", href: "/training/method" }}
      />,
    );

    expect(screen.getByText("Learning path")).toBeInTheDocument();
    expect(screen.queryByText("MODULE 1")).not.toBeInTheDocument();
  });

  it("shows a Coming soon tag and no clickable link when there is no primary destination yet", () => {
    render(
      <HubModuleTile
        tag="MODULE 2"
        title="The Skill Wheel Exercise"
        description="The core rep — label eight wedges and shade each to your honest score."
      />,
    );

    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps both destinations inside the training platform", () => {
    render(
      <HubModuleTile
        tag="OUR SOFTWARE"
        title="Alleato PM Software — How to Use It"
        description="Learn our own project management platform."
        primaryLink={{
          label: "Software Guide",
          href: "/training/guides/alleato-pm-software-guide",
        }}
        secondaryLink={{
          label: "Training Library",
          href: "/training/library",
        }}
      />,
    );

    const internal = screen.getByRole("link", { name: "Training Library" });
    expect(internal).toHaveAttribute("href", "/training/library");
    expect(internal).not.toHaveAttribute("target");
  });

  it("fails loudly when a module attempts to redirect outside training", () => {
    expect(() =>
      render(
        <HubModuleTile
          tag="OUR SOFTWARE"
          title="Alleato PM Software"
          description="Learn Alleato."
          primaryLink={{
            label: "External hub",
            href: "https://example.com/training",
          }}
        />,
      ),
    ).toThrow(
      "Training hub destination 'https://example.com/training' must stay inside /training.",
    );
  });
});
