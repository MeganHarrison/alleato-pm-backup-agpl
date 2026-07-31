/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";

import { ResourceCard } from "../ResourceCard";
import { fixtureResources } from "../__fixtures__/training-fixtures";

describe("ResourceCard", () => {
  it("routes a published video to its internal lesson page", () => {
    const resource = fixtureResources.find((item) => item.id === "sov-basics")!;
    render(<ResourceCard resource={resource} />);

    expect(screen.queryByTitle(resource.title)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open lesson/i })).toHaveAttribute(
      "href",
      `/training/resources/${resource.id}`,
    );
  });

  it("routes a non-embeddable published resource to its internal lesson page", () => {
    const resource = fixtureResources.find(
      (item) => item.id === "daily-logs-basics",
    )!;
    render(<ResourceCard resource={resource} />);

    expect(screen.queryByTitle(resource.title)).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open lesson/i });
    expect(link).toHaveAttribute("href", `/training/resources/${resource.id}`);
  });

  it("rejects an arbitrary iframe source and keeps the internal lesson route", () => {
    const resource = {
      ...fixtureResources.find((item) => item.id === "sov-basics")!,
      embed: {
        canEmbed: true,
        provider: "untrusted",
        embedUrl: "https://untrusted.example/embed/video",
      },
    };

    render(<ResourceCard resource={resource} />);

    expect(screen.queryByTitle(resource.title)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open lesson/i })).toHaveAttribute(
      "href",
      `/training/resources/${resource.id}`,
    );
  });

  it("shows a status badge only for non-published resources", () => {
    const review = fixtureResources.find((item) => item.status === "review")!;
    const published = fixtureResources.find(
      (item) => item.status === "published",
    )!;

    const { rerender } = render(<ResourceCard resource={review} />);
    expect(screen.getByText("review")).toBeInTheDocument();

    rerender(<ResourceCard resource={published} />);
    expect(screen.queryByText("published")).not.toBeInTheDocument();
  });

  it("supports review context and actions without adding another container", () => {
    const review = fixtureResources.find((item) => item.status === "review")!;

    const { container } = render(
      <ResourceCard
        resource={review}
        details={["Safety", "Project Manager"]}
        actions={<Button type="button">Publish</Button>}
        showStatus={false}
      />,
    );

    expect(screen.getByText(/safety · project manager/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByText("review")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-slot='card']")).toHaveLength(0);
  });

  it("keeps video embeds out of dense reviewer lists", () => {
    const video = fixtureResources.find((item) => item.status === "review")!;

    render(<ResourceCard resource={video} showEmbed={false} />);

    expect(screen.queryByTitle(video.title)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review source" })).toHaveAttribute(
      "href",
      video.url,
    );
  });

  it("renders the library tile variant as one canonical linked card", () => {
    const resource = fixtureResources.find((item) => item.id === "sov-basics")!;
    const { container } = render(
      <ResourceCard
        resource={resource}
        topicName="Budgets"
        variant="tile"
        showEmbed={false}
      />,
    );

    expect(container.querySelector("[data-slot='card']")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Reading a Schedule of Values/i }),
    ).toHaveAttribute("href", `/training/resources/${resource.id}`);
    expect(screen.queryByText("Video")).not.toBeInTheDocument();
    const audience = screen.getByText("Financials");
    const formatIcon = screen.getByLabelText("Format: Video");
    const fieldReady = screen.getByText("Field Ready");
    expect(formatIcon).toHaveAttribute("title", "Video");
    expect(formatIcon.parentElement).toBe(fieldReady.parentElement);
    expect(audience.parentElement).toBe(
      screen.getByRole("link", {
        name: /Reading a Schedule of Values/i,
      }).firstElementChild,
    );
    expect(screen.getByText("View Training")).toBeInTheDocument();
    const title = screen.getByRole("heading", {
      name: "Reading a Schedule of Values",
      level: 3,
    });
    expect(title).toHaveClass("text-base", "leading-6");
    expect(title).not.toHaveClass("text-lg", "leading-7");
  });

  it.each([
    ["change-orders-deep-dive", "Course"],
    ["daily-logs-basics", "Document"],
  ])("uses an accessible format icon for %s", (resourceId, label) => {
    const resource = fixtureResources.find((item) => item.id === resourceId)!;

    render(
      <ResourceCard resource={resource} variant="tile" showEmbed={false} />,
    );

    expect(screen.getByLabelText(`Format: ${label}`)).toHaveAttribute(
      "title",
      label,
    );
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  });
});
