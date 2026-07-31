/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";
import { requireTrainingReviewerPageAccess } from "@/lib/training/reviewer-access";
import {
  getDiscoveryMetrics,
  getPendingFreshnessReviews,
  getResources,
  getRoles,
  getTopics,
} from "@/lib/training/server";

import TrainingReviewPage from "../page";

jest.mock("@/lib/training/reviewer-access", () => ({
  requireTrainingReviewerPageAccess: jest.fn(),
}));

jest.mock("@/lib/training/server", () => ({
  getDiscoveryMetrics: jest.fn(),
  getPendingFreshnessReviews: jest.fn(),
  getResources: jest.fn(),
  getRoles: jest.fn(),
  getTopics: jest.fn(),
}));

jest.mock("@/components/layout", () => ({
  PageShell: ({
    title,
    description,
    children,
  }: {
    title: string;
    description: string;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </main>
  ),
  SectionRuleHeading: ({ label }: { label: React.ReactNode }) => (
    <div role="heading" aria-level={2}>
      {label}
    </div>
  ),
}));

jest.mock("@/features/training", () => ({
  toTrainingResourceViewModel: (resource: { id: string; title: string }) => ({
    ...resource,
  }),
  ResourceCard: ({
    resource,
    details,
    actions,
  }: {
    resource: { title: string };
    details?: string[];
    actions: React.ReactNode;
  }) => (
    <article>
      <div role="heading" aria-level={2}>
        {resource.title}
      </div>
      {details?.map((detail) => (
        <span key={detail}>{detail}</span>
      ))}
      {actions}
    </article>
  ),
}));

jest.mock("../review-decision-form", () => ({
  ReviewDecisionForm: () => (
    <div>
      <Button type="button">Archive</Button>
      <Button type="button">Publish</Button>
    </div>
  ),
}));

jest.mock("../freshness-decision-form", () => ({
  FreshnessDecisionForm: () => (
    <span role="button" tabIndex={0}>
      review freshness
    </span>
  ),
}));

jest.mock("../training-resource-finder-form", () => ({
  TrainingResourceFinderForm: ({
    roles,
    topics,
  }: {
    roles: Array<{ name: string }>;
    topics: Array<{ name: string }>;
  }) => (
    <span role="button" tabIndex={0}>
      Find resources for {roles[0]?.name} / {topics[0]?.name}
    </span>
  ),
}));

const requireAdminMock = jest.mocked(requireTrainingReviewerPageAccess);
const getPendingFreshnessReviewsMock = jest.mocked(getPendingFreshnessReviews);
const getDiscoveryMetricsMock = jest.mocked(getDiscoveryMetrics);
const getResourcesMock = jest.mocked(getResources);
const getRolesMock = jest.mocked(getRoles);
const getTopicsMock = jest.mocked(getTopics);

const reviewResource = {
  id: "9b2ce458-b438-4147-96a0-54f28a58b994",
  topicId: "topic-1",
  topicSlug: "safety",
  topicName: "Safety",
  title: "Jobsite Safety",
  description: "Review this source.",
  url: "https://example.com/safety",
  embedUrl: null,
  thumbnailUrl: null,
  provider: "Example",
  type: "course" as const,
  level: "intro" as const,
  track: "field_safety",
  status: "review" as const,
  durationMinutes: 20,
  roles: [],
};

const roles = [
  {
    id: "role-1",
    slug: "project-manager",
    name: "Project Manager",
    description: null,
    aliases: [],
    sortOrder: 1,
  },
];

const topics = [
  {
    id: "topic-1",
    slug: "change-management",
    name: "Change Management",
    description: null,
    sortOrder: 1,
  },
];

describe("TrainingReviewPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAdminMock.mockResolvedValue("a50665e0-509d-4d87-a930-d2cfd3abc22a");
    getRolesMock.mockResolvedValue(roles);
    getTopicsMock.mockResolvedValue(topics);
    getPendingFreshnessReviewsMock.mockResolvedValue([]);
    getDiscoveryMetricsMock.mockResolvedValue({
      activePolicy: {
        version: "feedback-ranking-v2",
        explorationRate: 0.15,
        activatedAt: "2026-07-30T00:00:00Z",
        evaluation: { sampleSize: 0 },
      },
      runs: 2,
      candidates: 8,
      reviewed: 4,
      published: 3,
      archived: 1,
      duplicates: 2,
      approvalRate: 0.75,
      strategyPerformance: [
        {
          strategy: "role_topic_course",
          reviewed: 4,
          published: 3,
          approval_rate: 0.75,
        },
      ],
    });
  });

  it("gates before loading the review queue", async () => {
    requireAdminMock.mockRejectedValue(new Error("redirect:access-denied"));

    await expect(
      TrainingReviewPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("redirect:access-denied");
    expect(getResourcesMock).not.toHaveBeenCalled();
  });

  it("shows pending resources and both reviewer decisions to an app admin", async () => {
    getResourcesMock.mockResolvedValue([reviewResource]);

    render(await TrainingReviewPage({ searchParams: Promise.resolve({}) }));

    expect(requireAdminMock).toHaveBeenCalledTimes(1);
    expect(getResourcesMock).toHaveBeenCalledWith({ status: "review" });
    expect(
      screen.getByRole("heading", { name: "Training review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Jobsite Safety" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /publish/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /archive/i }),
    ).toBeInTheDocument();
    const learningRegion = screen.getByRole("region", {
      name: "Discovery learning performance",
    });
    expect(learningRegion).toHaveTextContent("feedback-ranking-v2");
    expect(learningRegion).toHaveTextContent(
      "Policy evaluation currently contains 0 reviewed decisions",
    );
  });

  it("renders a quiet empty queue instead of filters or helper panels", async () => {
    getResourcesMock.mockResolvedValue([]);

    render(await TrainingReviewPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText("No new resources are waiting for review."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No freshness findings are waiting for review."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /find resources for project manager/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /publish/i }),
    ).not.toBeInTheDocument();
  });

  it("shows repeated freshness evidence without changing the published resource", async () => {
    getResourcesMock.mockResolvedValue([]);
    getPendingFreshnessReviewsMock.mockResolvedValue([
      {
        checkId: "10eaaf47-e1fc-4867-8954-05911f10f298",
        resource: { ...reviewResource, status: "published" },
        outcome: "unavailable",
        recommendedAction: "archive",
        occurrenceCount: 2,
        lastSeenAt: "2026-07-27T20:00:00Z",
        httpStatus: 410,
        finalUrl: reviewResource.url,
        observedTitle: null,
      },
    ]);

    render(await TrainingReviewPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Freshness findings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
    expect(screen.getByText("HTTP 410")).toBeInTheDocument();
    expect(screen.getByText("Seen 2 times")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "review freshness" }),
    ).toBeInTheDocument();
  });
});
