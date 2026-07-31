/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { HTMLAttributes, ImgHTMLAttributes } from "react";
import { ProjectCreatedModal } from "@/components/project/ProjectCreatedModal";

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
    // eslint-disable-next-line design-system/no-raw-heading
    h2: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  },
  useReducedMotion: () => true,
}));

jest.mock("next/image", () => (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />);

describe("ProjectCreatedModal", () => {
  it("routes Create Budget to the canonical project budget URL and only closes the modal", () => {
    const onClose = jest.fn();
    const onViewDashboard = jest.fn();

    render(
      <ProjectCreatedModal
        isOpen
        onClose={onClose}
        onViewDashboard={onViewDashboard}
        projectId="123"
        projectName="Test Project"
      />
    );

    const createBudgetLink = screen.getByRole("link", { name: /create budget/i });
    expect(createBudgetLink).toHaveAttribute("href", "/123/budget");

    fireEvent.click(createBudgetLink);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onViewDashboard).not.toHaveBeenCalled();
  });

  it("navigates to project home only from View Dashboard", () => {
    const onClose = jest.fn();
    const onViewDashboard = jest.fn();

    render(
      <ProjectCreatedModal
        isOpen
        onClose={onClose}
        onViewDashboard={onViewDashboard}
        projectId="123"
        projectName="Test Project"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /view dashboard/i }));

    expect(onViewDashboard).toHaveBeenCalledTimes(1);
  });
});
