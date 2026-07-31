/** @jest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";

// Passthrough mock for any motion.<tag>. Motion-only props are stripped while
// an animated SVG path remains available to structural assertions.
jest.mock("motion/react", () => {
  const React = require("react");
  const passthrough =
    (tag: string) =>
    ({
      animate,
      initial: _initial,
      transition: _transition,
      whileHover: _whileHover,
      whileInView: _whileInView,
      viewport: _viewport,
      ...props
    }: Record<string, unknown> & { animate?: { d?: string } }) => {
      const merged: Record<string, unknown> = { ...props };
      if (animate && typeof animate.d === "string") merged.d = animate.d;
      return React.createElement(tag, merged);
    };
  return {
    motion: new Proxy({}, { get: (_target, tag: string) => passthrough(tag) }),
    useInView: () => true,
    useReducedMotion: () => false,
  };
});

// gsap / @gsap/react ship untransformed ESM (see jest transformIgnorePatterns),
// so they must be mocked here. useGSAP is a no-op: the story renders its JSX at
// the illustrative "before" state, which is all these structural checks need.
// The scroll animation itself is verified in the browser, not jsdom.
jest.mock("gsap", () => {
  const api = { registerPlugin: () => {} };
  return { __esModule: true, default: api, gsap: api };
});
jest.mock("gsap/ScrollTrigger", () => ({
  __esModule: true,
  ScrollTrigger: {},
}));
jest.mock("@gsap/react", () => ({ __esModule: true, useGSAP: () => {} }));

// jsdom has no matchMedia; the GSAP story reads it via gsap.matchMedia().
// A no-match stub means no timeline branch runs, so the wheels render at their
// initial (illustrative "before") state — enough for these structural checks.
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

import { TrainingHubClient } from "../TrainingHubClient";

function renderHub() {
  return render(
    <TrainingHubClient
      moduleTiles={[
        {
          tag: "Module 1",
          title: "The Method",
          description: "Practice the system.",
          primaryLink: { label: "Read the method", href: "/training/method" },
        },
      ]}
      methodIntro="Build skill through precise reps."
      methodPrinciples={[
        { name: "Own it", text: "Lead your development." },
        { name: "Get specific", text: "Choose a precise skill." },
      ]}
    />,
  );
}

describe("TrainingHubClient skill wheel story", () => {
  it("uses compact step labels for the method cards", () => {
    renderHub();

    expect(screen.getAllByText(/^Step \d+$/)).toHaveLength(2);
  });

  it("renders the pinned story opening on the default role", () => {
    renderHub();

    expect(
      screen.getByRole("heading", {
        name: "Growth starts with an honest picture.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Project Engineer skill wheel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Illustrative Project Engineer progression/i),
    ).toBeInTheDocument();
  });

  it("switches the wheel when a different role is picked", () => {
    renderHub();

    const superintendent = screen.getByRole("button", {
      name: "Superintendent",
    });
    expect(superintendent).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(superintendent);

    expect(superintendent).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("img", { name: "Superintendent skill wheel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Illustrative Superintendent progression/i),
    ).toBeInTheDocument();
  });

  it("derives each focus pair from the selected role's own weakest skills", () => {
    renderHub();

    // Project Engineer before = [40,48,70,68,38,45,66,52]; the two lowest are
    // Procurement (38) and Drawing fluency (40), so cycle one must name them.
    expect(screen.getByText("Procurement")).toBeInTheDocument();
    expect(screen.getByText("Drawing fluency")).toBeInTheDocument();
  });

  it("renders the proficiency ladder open on the Solo bar", () => {
    renderHub();

    const solo = screen.getByRole("button", { name: /^80\s*Solo/i });
    expect(solo).toHaveAttribute("aria-pressed", "true");

    // The bar the wheel counts against, explained.
    expect(screen.getByText("You can be trusted with the hard version.")).toBeInTheDocument();
    expect(screen.getByText(/one problem, three options, one recommendation/i)).toBeInTheDocument();
  });

  it("explains whichever rung is selected", () => {
    renderHub();

    fireEvent.click(screen.getByRole("button", { name: /^10\s*Aware/i }));

    expect(screen.getByText("You can recognize the work.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^80\s*Solo/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the library as a numbered list of linked rows", () => {
    const { container } = renderHub();

    const rows = container.querySelectorAll("#library ol li");
    expect(rows).toHaveLength(1);
    expect(screen.getByRole("link", { name: /The Method/ })).toHaveAttribute(
      "href",
      "/training/method",
    );
    expect(
      screen.getByRole("link", { name: /Browse all training/i }),
    ).toHaveAttribute("href", "/training/library");
  });

  it("closes on a statement with both paths forward", () => {
    renderHub();

    expect(
      screen.getByRole("heading", { name: "Fifteen minutes to your first wheel." }),
    ).toBeInTheDocument();
    // The hero opens with the same call; this asserts the closing one, which is
    // the last on the page.
    const assessmentLinks = screen.getAllByRole("link", {
      name: /Take the assessment/i,
    });
    expect(assessmentLinks.at(-1)).toHaveAttribute("href", "/training/growth");
    expect(
      screen.getByRole("link", { name: /Read the method first/i }),
    ).toHaveAttribute("href", "/training/method");
  });

  it("no longer renders the replaced accordion or the toolkit", () => {
    const { container } = renderHub();

    expect(
      screen.queryByRole("heading", { name: "Core skills. Then your role." }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Quick toolkit" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("The 1-3-1 rule")).not.toBeInTheDocument();
    expect(container.querySelector("[data-capability-ladder]")).toBeNull();
  });
});
