/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ActivityFeedRow } from "../activity-feed";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("ActivityFeedRow", () => {
  it("renders a secondary team chat follow-up link for comment activity", () => {
    const { container } = render(
      <ActivityFeedRow
        item={{
          id: "comment:annotation-1",
          title: "Brandon Clymer replied in comments",
          body: "Following up on this now.",
          href: "/comments?thread=annotation-1",
          secondaryHref: "/team-chat?discussion=annotation-1",
          secondaryLabel: "Team chat",
          createdAt: "2026-07-06T09:00:00.000Z",
          avatarLabel: "BC",
          sourceLabel: "876 / budget",
          kind: "comment",
        }}
      />,
    );

    const primaryLink = container.querySelector('a[href="/comments?thread=annotation-1"]');
    expect(primaryLink).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Team chat" })).toHaveAttribute(
      "href",
      "/team-chat?discussion=annotation-1",
    );
  });
});
