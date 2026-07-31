/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { canCurrentUserReviewTraining } from "@/lib/training/reviewer-access";
import {
  getPendingFreshnessReviews,
  getResources,
  getRoles,
  getTopics,
} from "@/lib/training/server";

import TrainingLibraryPage from "../page";

jest.mock("@/lib/training/server", () => ({
  getPendingFreshnessReviews: jest.fn(),
  getResources: jest.fn(),
  getRoles: jest.fn(),
  getTopics: jest.fn(),
}));

jest.mock("@/lib/training/reviewer-access", () => ({
  canCurrentUserReviewTraining: jest.fn(),
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({
    title,
    titleContent,
    actions,
    children,
    variant,
  }: {
    title: string;
    titleContent?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    variant: string;
  }) => (
    <main data-variant={variant}>
      <header>
        {titleContent ?? <h1>{title}</h1>}
        {actions}
      </header>
      {children}
    </main>
  ),
}));

jest.mock("../../training-page-client", () => ({
  TrainingPageClient: () => <div>Training library</div>,
}));

jest.mock("@/features/training", () => ({
  buildTrainingLibraryPageModel: jest.fn(() => ({
    roles: [],
    topics: [],
    tracks: [],
    resources: [],
    initialRoleId: null,
  })),
}));

const canReviewMock = jest.mocked(canCurrentUserReviewTraining);
const getPendingFreshnessReviewsMock = jest.mocked(
  getPendingFreshnessReviews,
);
const getResourcesMock = jest.mocked(getResources);
const getRolesMock = jest.mocked(getRoles);
const getTopicsMock = jest.mocked(getTopics);

describe("TrainingLibraryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getResourcesMock.mockResolvedValue([]);
    getPendingFreshnessReviewsMock.mockResolvedValue([]);
    getRolesMock.mockResolvedValue([]);
    getTopicsMock.mockResolvedValue([]);
    canReviewMock.mockResolvedValue(false);
  });

  it("shows the contextual review action when the canonical admin RPC allows it", async () => {
    canReviewMock.mockResolvedValue(true);
    getResourcesMock.mockImplementation(async (filters = {}) =>
      filters.status === "review"
        ? ([{ id: "review-1" }, { id: "review-2" }] as never)
        : [],
    );
    getPendingFreshnessReviewsMock.mockResolvedValue([
      { checkId: "freshness-1" },
    ] as never);

    render(await TrainingLibraryPage());

    expect(
      screen.getByRole("link", { name: "Review queue (3)" }),
    ).toHaveAttribute("href", "/training/review");
    expect(getResourcesMock).toHaveBeenCalledWith({ status: "review" });
    expect(getPendingFreshnessReviewsMock).toHaveBeenCalledTimes(1);
  });

  it("uses the standard app shell and keeps the learner page quiet", async () => {
    canReviewMock.mockResolvedValue(false);

    render(await TrainingLibraryPage());

    expect(
      screen.getByRole("heading", {
        name: "Resource Library",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Field integrity & execution playbooks"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Review queue/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Training resources" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Gain direct access to advanced structural blueprints/),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-variant",
      "detailWide",
    );
    const hero = screen.getByRole("banner").firstElementChild;
    expect(hero).toHaveClass("py-8", "sm:py-10");
    expect(hero).not.toHaveClass("lg:min-h-[17.5rem]", "lg:py-14");
    expect(getResourcesMock).not.toHaveBeenCalledWith({ status: "review" });
    expect(getPendingFreshnessReviewsMock).not.toHaveBeenCalled();
  });

  it("fails loudly when reviewer visibility cannot be resolved", async () => {
    canReviewMock.mockRejectedValue(
      new Error("Training reviewer access check failed: RPC unavailable"),
    );

    await expect(TrainingLibraryPage()).rejects.toThrow(
      "Training reviewer access check failed: RPC unavailable",
    );
  });
});
