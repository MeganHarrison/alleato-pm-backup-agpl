/**
 * @jest-environment jsdom
 */
/* eslint-disable design-system/no-raw-heading -- test doubles expose semantic heading roles */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import RfiDetailPage from "../page";
import { serviceDb } from "@/lib/supabase/service-db";
import type { RFI } from "@/types/database-extensions";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: { from: jest.fn() },
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({ children, title, description, statusBadge }: {
    children: ReactNode;
    title: string;
    description?: ReactNode;
    statusBadge?: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {description ? <div data-testid="rfi-header-description">{description}</div> : null}
      {statusBadge ? <div data-testid="rfi-header-status">{statusBadge}</div> : null}
      {children}
    </main>
  ),
  ContentSectionStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DetailLayout: ({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) => (
    <div>{children}{sidebar}</div>
  ),
  SectionRuleHeading: ({ label }: { label: string }) => <h2>{label}</h2>,
}));

jest.mock("../rfi-header-actions", () => ({
  RfiHeaderActions: () => <div>header actions</div>,
}));

jest.mock("../rfi-detail", () => ({
  RfiDetail: () => <div>rfi detail body</div>,
}));

const rfi = {
  id: "1df9c180-b5df-4afd-99b6-3da27289086a",
  number: 1,
  status: "open",
  subject: "Test RFI",
  question: "Test question",
  assignees: [],
  is_private: false,
  created_at: "2026-07-16T00:00:00.000Z",
} as RFI;

describe("RFI detail hierarchy", () => {
  beforeEach(() => {
    jest.mocked(serviceDb.from).mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ single: async () => ({ data: rfi, error: null }) }) }) }),
    } as never);
  });

  it("keeps created date and status out of the RFI page header", async () => {
    render(
      await RfiDetailPage({
        params: Promise.resolve({ projectId: "1142", rfiId: rfi.id }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("heading", { name: "Test RFI" })).toBeInTheDocument();
    expect(screen.queryByTestId("rfi-header-description")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rfi-header-status")).not.toBeInTheDocument();
  });

});
