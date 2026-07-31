/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { usePathname } from "next/navigation";

import { MobileBottomNav } from "../mobile-bottom-nav";
import { useProject } from "@/contexts/project-context";
import { useSidebar } from "@/components/ui/sidebar";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@/contexts/project-context", () => ({
  useProject: jest.fn(),
}));

jest.mock("@/components/ui/sidebar", () => ({
  useSidebar: jest.fn(),
}));

// Keep the nav test focused on navigation behavior.
jest.mock("../mobile-bottom-nav-alert-badge", () => ({
  BottomNavAlertBadge: () => null,
}));

const mockUsePathname = usePathname as jest.Mock;
const mockUseProject = useProject as jest.Mock;
const mockUseSidebar = useSidebar as jest.Mock;

const setOpenMobile = jest.fn();

function setup({
  pathname = "/",
  projectId = null,
}: {
  pathname?: string;
  projectId?: number | null;
} = {}) {
  mockUsePathname.mockReturnValue(pathname);
  mockUseProject.mockReturnValue({ projectId });
  mockUseSidebar.mockReturnValue({ setOpenMobile });
  return render(<MobileBottomNav />);
}

describe("MobileBottomNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the four primary tabs", () => {
    setup();
    expect(screen.getByLabelText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("AI")).toBeInTheDocument();
    expect(screen.getByLabelText("Alerts")).toBeInTheDocument();
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("points AI and Alerts at their real routes", () => {
    setup();
    expect(screen.getByLabelText("AI")).toHaveAttribute("href", "/ai");
    expect(screen.getByLabelText("Alerts")).toHaveAttribute(
      "href",
      "/notifications",
    );
  });

  it("resolves Home to the company root when there is no active project", () => {
    setup({ projectId: null });
    expect(screen.getByLabelText("Home")).toHaveAttribute("href", "/");
  });

  it("resolves Home to the project home when a project is active", () => {
    setup({ projectId: 876 });
    expect(screen.getByLabelText("Home")).toHaveAttribute("href", "/876/home");
  });

  it("marks the AI tab active on /ai routes", () => {
    setup({ pathname: "/ai/threads/123" });
    expect(screen.getByLabelText("AI")).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Home")).not.toHaveAttribute("aria-current");
  });

  it("marks Home active on a bare project route", () => {
    setup({ pathname: "/876", projectId: 876 });
    expect(screen.getByLabelText("Home")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("opens the navigation drawer when Menu is tapped", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(setOpenMobile).toHaveBeenCalledWith(true);
  });

  it("is hidden on desktop via the md:hidden breakpoint", () => {
    const { container } = setup();
    const nav = within(container).getByLabelText("Primary");
    expect(nav.className).toContain("md:hidden");
  });
});
