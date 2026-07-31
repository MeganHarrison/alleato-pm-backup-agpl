/** @jest-environment jsdom */

import { render, screen, within } from "@testing-library/react";

import { KnowledgeHomePage } from "../knowledge-home-page";

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
    <div>
      <div role="heading" aria-level={1}>
        {title}
      </div>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
  SectionRuleHeading: ({ label }: { label: React.ReactNode }) => (
    <div role="heading" aria-level={2}>
      {label}
    </div>
  ),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("KnowledgeHomePage", () => {
  it("renders only the two top-level knowledge group choices", () => {
    render(<KnowledgeHomePage />);

    expect(
      screen.getByRole("heading", { name: "Knowledge" }),
    ).toBeInTheDocument();

    const groupNav = screen.getByRole("region", { name: "Knowledge groups" });
    const links = within(groupNav).getAllByRole("link");

    expect(links).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: /How to Use the App/ }),
    ).toHaveAttribute("href", "/knowledge/app");
    expect(
      screen.getByRole("link", { name: /Company Knowledge Base/ }),
    ).toHaveAttribute("href", "/knowledge/company");
  });
});
