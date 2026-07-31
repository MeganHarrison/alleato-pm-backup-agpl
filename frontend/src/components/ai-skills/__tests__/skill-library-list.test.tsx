/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { SkillLibraryList } from "../skill-library-list";
import { apiFetch } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("SkillLibraryList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders user-facing skill rows and the Teach Alleato action", async () => {
    apiFetchMock.mockResolvedValue({
      skills: [
        {
          id: "skill-1",
          title: "Budget variance reviewer",
          summary: "Reviews budget variance before owner updates.",
          category: "Budget",
          scope: "project",
          projectId: 760,
          projectName: "Westfield Collective",
          ownerName: "Operations",
          reviewerName: "Brandon",
          version: "1.2.0",
          examples: [{ input: "Check direct cost drift" }],
          usageCount: 14,
          lastUsedAt: "2026-06-17T12:00:00.000Z",
        },
      ],
      filters: {
        categories: ["Budget"],
        scopes: ["project"],
        projects: [{ id: 760, name: "Westfield Collective" }],
      },
    });

    render(<SkillLibraryList mode="user" endpoint="/api/ai-assistant/skills" />);

    expect(await screen.findByText("Budget variance reviewer")).toBeInTheDocument();
    expect(screen.getByText("Reviews budget variance before owner updates.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Teach Alleato" })).toHaveAttribute(
      "href",
      "/ai/teach",
    );
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("fails loudly when the API reports the service dependency gap", async () => {
    apiFetchMock.mockRejectedValue(new Error("Skill Library service is not available."));

    render(<SkillLibraryList mode="admin" endpoint="/api/admin/ai-skills" />);

    await waitFor(() => {
      expect(screen.getByText("Skill Library could not load")).toBeInTheDocument();
    });
    expect(screen.getByText("Skill Library service is not available.")).toBeInTheDocument();
  });
});
