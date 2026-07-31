/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactNode } from "react";

const mockGetExecutiveBriefingDashboard = jest.fn();
const mockFrom = jest.fn();

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({
    children,
    title,
    description,
  }: {
    children: ReactNode;
    title: string;
    description: string;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  ),
}));

jest.mock("@/components/executive/executive-brief-email-form", () => ({
  ExecutiveBriefEmailForm: ({
    draftId,
    defaultRecipients,
    defaultSubject,
  }: {
    draftId: string;
    defaultRecipients: string;
    defaultSubject: string;
  }) => (
    <div data-testid="daily-brief-email-form">
      {draftId}|{defaultRecipients}|{defaultSubject}
    </div>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("../admin-action-cards", () => ({
  AdminActionCards: () => <div>Other admin actions</div>,
}));

// Stub "@/lib/executive/daily-brief" so Jest never loads its real module graph:
// the real file re-exports from brandon-daily-update, which pulls in the ESM-only
// "ai" package and breaks Jest's CJS transform. page.tsx only needs the constant.
jest.mock("@/lib/executive/daily-brief", () => ({
  DEFAULT_EXECUTIVE_WINDOW_DAYS: 7,
}));

jest.mock("@/lib/executive/executive-briefing-workflow", () => ({
  getExecutiveBriefingDashboard: (...args: unknown[]) =>
    mockGetExecutiveBriefingDashboard(...args),
}));

jest.mock("@/lib/supabase/service-db", () => ({
  serviceDb: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import AdminActionsPage from "../page";

const missingDraftCopy =
  "No Daily Brief draft found. The refresh workflow may not have run yet today.";
const loadFailureCopy =
  "The send form stays disabled until the Daily Brief packet and Brandon preset load successfully.";

const dashboard = {
  draft: {
    id: "2026-07-13",
    recapDate: "2026-07-13",
  },
  followUps: [],
  openFollowUps: [],
  staleFollowUps: [],
  liveFingerprints: new Set(),
  fingerprintMap: new Map(),
};

type PeopleLookupResult = {
  data: {
    email: string | null;
  } | null;
  error: {
    message: string;
  } | null;
};

function mockPeopleLookup(result: PeopleLookupResult) {
  const single = jest.fn().mockResolvedValue(result);
  const limit = jest.fn().mockReturnValue({ single });
  const ilike = jest.fn().mockReturnValue({ limit });
  const select = jest.fn().mockReturnValue({ ilike });

  mockFrom.mockReturnValue({ select });
}

async function renderPage() {
  render(await AdminActionsPage({ searchParams: Promise.resolve({}) }));
}

describe("AdminActionsPage Daily Brief card", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the email form when Daily Brief data loads successfully", async () => {
    mockGetExecutiveBriefingDashboard.mockResolvedValue(dashboard);
    mockPeopleLookup({
      data: { email: "brandon@example.com" },
      error: null,
    });

    await renderPage();

    expect(screen.getByTestId("daily-brief-email-form")).toHaveTextContent(
      "2026-07-13|brandon@example.com|Daily Brief — 2026-07-13",
    );
    expect(screen.queryByText(missingDraftCopy)).not.toBeInTheDocument();
    expect(screen.queryByText("Daily Brief data failed to load.")).not.toBeInTheDocument();
  });

  it("uses the missing-draft copy only for a true empty Daily Brief state", async () => {
    mockGetExecutiveBriefingDashboard.mockResolvedValue({
      ...dashboard,
      draft: {
        id: "",
        recapDate: "",
      },
    });

    await renderPage();

    expect(screen.getByText(missingDraftCopy)).toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(screen.queryByText("Daily Brief data failed to load.")).not.toBeInTheDocument();
  });

  it("fails loudly when the Daily Brief dashboard lookup throws", async () => {
    mockGetExecutiveBriefingDashboard.mockRejectedValue(
      new Error("Executive packet lookup failed"),
    );

    await renderPage();

    expect(screen.getByText("Daily Brief data failed to load.")).toBeInTheDocument();
    expect(screen.getByText(loadFailureCopy)).toBeInTheDocument();
    expect(screen.getByText("Executive packet lookup failed")).toBeInTheDocument();
    expect(screen.queryByText(missingDraftCopy)).not.toBeInTheDocument();
  });

  it("fails loudly when the Brandon preset lookup returns a database error", async () => {
    mockGetExecutiveBriefingDashboard.mockResolvedValue(dashboard);
    mockPeopleLookup({
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned" },
    });

    await renderPage();

    expect(screen.getByText("Daily Brief data failed to load.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Failed to load Brandon email preset: JSON object requested, multiple (or no) rows returned",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(missingDraftCopy)).not.toBeInTheDocument();
  });
});
