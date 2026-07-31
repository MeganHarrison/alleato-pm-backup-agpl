/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";

import { AssignMemberDialog } from "../AssignMemberDialog";
import { apiFetch } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import type { ProjectRole } from "@/hooks/use-project-roles";

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}));

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function requestedUrls(): string[] {
  return apiFetchMock.mock.calls
    .map(([url]) => url)
    .filter((url): url is string => typeof url === "string");
}

function requestedGenericEmployeeAlias(url: string): boolean {
  const parsed = new URL(url, "http://localhost");
  return (
    parsed.pathname === "/api/people" &&
    parsed.searchParams.get("type") === "employee"
  );
}

const role: ProjectRole = {
  id: "role-1",
  role_name: "Project Manager",
  role_type: "project_manager",
  display_order: 1,
  members: [],
};

describe("AssignMemberDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiFetchMock.mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        per_page: 150,
        total: 0,
        total_pages: 1,
      },
    });

    createClientMock.mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
    } as never);
  });

  it("loads only the company-scoped Alleato employee roster", async () => {
    render(
      <AssignMemberDialog
        open
        onOpenChange={jest.fn()}
        role={role}
        onSave={jest.fn()}
        projectId="1149"
      />,
    );

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/directory/employees/table?per_page=150&status=active&sort=full_name%3Aasc&page=1",
      ),
    );

    expect(requestedUrls().some(requestedGenericEmployeeAlias)).toBe(false);
  });

  it("loads every page when the Alleato roster exceeds the endpoint page size", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const parsed = new URL(String(url), "http://localhost");
      const page = parsed.searchParams.get("page");

      return {
        data: [
          {
            id: `employee-${page}`,
            first_name: "Employee",
            last_name: page === "1" ? "One" : "Two",
            email: `employee-${page}@alleatogroup.com`,
            job_title: "Project Manager",
          },
        ],
        pagination: {
          page: Number(page),
          per_page: 150,
          total: 151,
          total_pages: 2,
        },
      };
    });

    render(
      <AssignMemberDialog
        open
        onOpenChange={jest.fn()}
        role={role}
        onSave={jest.fn()}
        projectId="1149"
      />,
    );

    expect(await screen.findByText("Employee Two")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/directory/employees/table?per_page=150&status=active&sort=full_name%3Aasc&page=2",
    );
    expect(requestedUrls().some(requestedGenericEmployeeAlias)).toBe(false);
  });
});
