/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";

import DeepResearchArchivePage from "../page";
import { apiFetch } from "@/lib/api-client";

const searchParams = new URLSearchParams({
  userId: "admin",
  topicSlug: "tilt-up-vs-precast",
  sessionId: "session-1",
});

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/deep-research",
  useRouter: () => ({
    replace: jest.fn(),
  }),
  useSearchParams: () => searchParams,
}));

const mockApiFetch = jest.mocked(apiFetch);

describe("DeepResearchArchivePage", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("fails loudly when selected workspace artifacts cannot load", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        projects: [
          {
            userId: "admin",
            topic: "Tilt-up vs precast",
            topicSlug: "tilt-up-vs-precast",
            sessionId: "session-1",
            wikiPath: "/tmp/wiki",
            title: "Tilt-up vs precast Wiki",
            updatedAt: "2026-06-22T12:00:00Z",
            artifactCount: 3,
            markdownCount: 2,
            sourceCount: 1,
            logSummary: "Compared structural tradeoffs.",
          },
        ],
        selectedProject: null,
        artifacts: [],
      })
      .mockRejectedValueOnce(new Error("Backend archive timed out"));

    render(<DeepResearchArchivePage />);

    expect(await screen.findByText("Tilt-up vs precast")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Couldn't load files")).toBeInTheDocument();
    });

    expect(screen.getByText("Backend archive timed out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
