/** @jest-environment jsdom */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import type { TrainingResource } from "@/lib/training/types";

import { TrainingResourcePageContent } from "../TrainingResourcePage";

jest.mock("@/components/layout", () => ({
  PageShell: ({
    title,
    description,
    children,
  }: {
    title: string;
    description?: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </main>
  ),
  SectionRuleHeading: ({
    label,
  }: {
    label: React.ReactNode;
  }) => (
    <div role="heading" aria-level={2}>
      {label}
    </div>
  ),
}));

const baseResource: TrainingResource = {
  id: "resource-1",
  topicId: "topic-1",
  topicSlug: "drawings",
  topicName: "Reading Drawings",
  title: "Read Structural Construction Drawings",
  description: "Learn how to interpret a structural drawing set.",
  url: "https://www.youtube.com/watch?v=HBSl8j3JkSA",
  embedUrl: null,
  thumbnailUrl: null,
  provider: "YouTube",
  type: "video",
  level: "intro",
  track: "field",
  status: "published",
  durationMinutes: 12,
  roles: [],
};

describe("TrainingResourcePageContent", () => {
  it("renders a supported video inside the standardized lesson page", () => {
    render(<TrainingResourcePageContent resource={baseResource} />);

    expect(
      screen.getByRole("heading", { name: "Watch" }),
    ).toBeVisible();
    expect(
      screen.getByRole("complementary", { name: "Lesson information" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Lesson details" }),
    ).toBeVisible();
    expect(screen.getByText("Reading Drawings")).toBeVisible();
    expect(screen.getByText("12 min")).toBeVisible();
    expect(
      screen.getByTitle("Read Structural Construction Drawings"),
    ).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/HBSl8j3JkSA?enablejsapi=1",
    );
    expect(
      screen.getByRole("link", { name: "View original source" }),
    ).toHaveAttribute("href", baseResource.url);
  });

  it("falls back to a supported YouTube source when the stored embed URL is invalid", () => {
    render(
      <TrainingResourcePageContent
        resource={{
          ...baseResource,
          embedUrl: "https://untrusted.example/embed/HBSl8j3JkSA",
        }}
      />,
    );

    expect(
      screen.getByTitle("Read Structural Construction Drawings"),
    ).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/HBSl8j3JkSA?enablejsapi=1",
    );
    expect(
      screen.queryByText(/does not permit an on-page reader/i),
    ).not.toBeInTheDocument();
  });

  it("fails loudly instead of rendering a blank reader for unsupported documents", () => {
    const resource: TrainingResource = {
      ...baseResource,
      id: "resource-2",
      title: "MasterFormat Divisions",
      type: "doc",
      url: "https://example.com/masterformat",
      provider: "Example",
    };

    render(<TrainingResourcePageContent resource={resource} />);

    expect(screen.queryByTitle("MasterFormat Divisions reading view")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /does not permit an on-page reader.*still needs to be authored/i,
      ),
    ).toBeVisible();
  });
});
