/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";

import { getTrainingGuideBySlug } from "@/content/training-guides/catalog";

import TrainingGuidePage, { generateStaticParams } from "../page";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

jest.mock("@/content/training-guides/catalog", () => ({
  TRAINING_GUIDE_SLUGS: [
    "pm-handbook",
    "superintendent-handbook",
    "alleato-pm-software-guide",
    "manager-coaching-guide",
  ],
  getTrainingGuideBySlug: jest.fn(),
}));

jest.mock("@/components/docs/markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="guide-markdown">{content}</div>
  ),
}));

const getTrainingGuideBySlugMock = jest.mocked(getTrainingGuideBySlug);
const notFoundMock = jest.mocked(notFound);

describe("TrainingGuidePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prebuilds the four registered guide routes", () => {
    expect(generateStaticParams()).toEqual([
      { guideSlug: "pm-handbook" },
      { guideSlug: "superintendent-handbook" },
      { guideSlug: "alleato-pm-software-guide" },
      { guideSlug: "manager-coaching-guide" },
    ]);
  });

  it("renders the registered guide through the shared viewer", async () => {
    getTrainingGuideBySlugMock.mockResolvedValue({
      slug: "pm-handbook",
      title: "PM Handbook",
      description: "Office-side project management guide.",
      roleIds: ["project-manager"],
      body: "Guide body",
    });

    render(
      await TrainingGuidePage({
        params: Promise.resolve({ guideSlug: "pm-handbook" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "PM Handbook" })).toBeVisible();
    expect(screen.getByTestId("guide-markdown")).toHaveTextContent("Guide body");
  });

  it("uses the canonical not-found boundary for an unknown slug", async () => {
    getTrainingGuideBySlugMock.mockResolvedValue(null);

    await expect(
      TrainingGuidePage({
        params: Promise.resolve({ guideSlug: "unknown-guide" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
