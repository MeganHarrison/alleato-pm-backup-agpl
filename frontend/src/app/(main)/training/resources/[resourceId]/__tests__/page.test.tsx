/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";

import { getResources } from "@/lib/training/server";

import TrainingResourceDetailPage from "../page";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/training/resources/resource-1"),
  notFound: jest.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

jest.mock("@/lib/training/server", () => ({
  getResources: jest.fn(),
}));

const getTrainingPageShellPropsMock = jest.fn(
  ({ title, layout }: { title: string; layout?: string }) => ({
    variant: "content",
    title,
    layout,
  }),
);

jest.mock("@/features/training", () => ({
  getTrainingPageShellProps: (options: {
    title: string;
    layout?: string;
  }) => getTrainingPageShellPropsMock(options),
  TrainingResourcePageContent: ({
    resource,
  }: {
    resource: { title: string };
  }) => <div data-testid="training-resource-content">{resource.title}</div>,
}));

const getResourcesMock = jest.mocked(getResources);
const notFoundMock = jest.mocked(notFound);

describe("TrainingResourceDetailPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the matching published resource on its internal route", async () => {
    getResourcesMock.mockResolvedValue([
      {
        id: "resource-1",
        title: "Read Structural Construction Drawings",
      },
    ] as Awaited<ReturnType<typeof getResources>>);

    render(
      await TrainingResourceDetailPage({
        params: Promise.resolve({ resourceId: "resource-1" }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Read Structural Construction Drawings",
      }),
    ).toBeVisible();
    expect(getTrainingPageShellPropsMock).toHaveBeenCalledWith(
      expect.objectContaining({ layout: "media" }),
    );
  });

  it("uses the canonical not-found boundary for an unknown resource", async () => {
    getResourcesMock.mockResolvedValue([]);

    await expect(
      TrainingResourceDetailPage({
        params: Promise.resolve({ resourceId: "missing" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
