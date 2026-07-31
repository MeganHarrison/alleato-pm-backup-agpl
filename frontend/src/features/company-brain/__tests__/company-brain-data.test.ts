import type {
  BrainResourcePage,
  BrainResourceRow,
  BusinessArea,
} from "@/features/brain/brain-contract";
import {
  loadBrainResourcePage,
  loadBusinessAreaAccess,
  loadBusinessAreas,
} from "@/features/brain/brain-data";

import { loadCompanyBrainOverview } from "../company-brain-data";

jest.mock("server-only", () => ({}));

jest.mock("@/features/brain/brain-data", () => ({
  loadBrainResourcePage: jest.fn(),
  loadBusinessAreaAccess: jest.fn(),
  loadBusinessAreas: jest.fn(),
}));

const loadBrainResourcePageMock = jest.mocked(loadBrainResourcePage);
const loadBusinessAreaAccessMock = jest.mocked(loadBusinessAreaAccess);
const loadBusinessAreasMock = jest.mocked(loadBusinessAreas);

function area(
  id: number,
  name: string,
  isRestricted: boolean,
): BusinessArea {
  return {
    id,
    key: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    description: null,
    is_restricted: isRestricted,
    owner_person_id: null,
    created_at: "2026-07-24T00:00:00.000Z",
    updated_at: "2026-07-24T00:00:00.000Z",
  };
}

function page(rows: BrainResourceRow[]): BrainResourcePage {
  return {
    rows,
    total: rows.length,
    page: 1,
    perPage: 50,
    totalPages: rows.length ? 1 : 0,
    sortBy: "date",
    sortDirection: "desc",
    search: "",
  };
}

describe("Company Brain permission-scoped loader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("never queries or serializes inaccessible business-area content", async () => {
    const operations = area(1, "Operations", false);
    const secretFinance = area(2, "Secret Finance", true);
    loadBusinessAreasMock.mockResolvedValue([operations, secretFinance]);
    loadBusinessAreaAccessMock.mockImplementation(async (areaId) =>
      areaId === operations.id
        ? { area: operations, canAccess: true, isAdmin: false }
        : { area: secretFinance, canAccess: false, isAdmin: false },
    );
    loadBrainResourcePageMock.mockImplementation(async (areaId, tab) => {
      expect(areaId).toBe(operations.id);
      if (tab === "knowledge") {
        return page([
          {
            id: "knowledge-1",
            title: "Permitted operating note",
            detail: null,
            source: "Outlook",
            status: "processed",
            date: "2026-07-24T10:00:00.000Z",
            owner: null,
            href: null,
            signedDocumentId: null,
          },
        ]);
      }
      return page([]);
    });

    const overview = await loadCompanyBrainOverview("24h");
    const serialized = JSON.stringify(overview);

    expect(loadBrainResourcePageMock).toHaveBeenCalledTimes(2);
    expect(loadBrainResourcePageMock).not.toHaveBeenCalledWith(
      secretFinance.id,
      expect.anything(),
      expect.anything(),
    );
    expect(serialized).not.toContain("Secret Finance");
    expect(serialized).not.toContain(`"id":${secretFinance.id}`);
    expect(overview.permissionLimited).toBe(true);
    expect(
      overview.nodes
        .filter((node) => node.kind === "source")
        .map((node) => node.name),
    ).toEqual(["Fireflies", "Outlook", "Teams", "SharePoint", "OneDrive"]);
    expect(
      overview.nodes
        .filter(
          (node) =>
            node.permissions.canView &&
            (node.kind === "agent" || node.kind === "outcome"),
        )
        .map((node) => node.name),
    ).toEqual([
      "Executive Brief",
      "Project Intelligence",
      "Tasks Generated",
      "Risks Identified",
      "Change Events",
      "Opportunities",
    ]);
    expect(
      overview.nodes.find((node) => node.name === "OneDrive"),
    ).toEqual(expect.objectContaining({ count: null, status: "unknown" }));
    expect(
      overview.nodes.find((node) => node.id === "agent-catalog"),
    ).toEqual(
      expect.objectContaining({
        name: "Agent catalog restricted",
        count: null,
        permissions: expect.objectContaining({ canView: false }),
      }),
    );
  });

  it("replaces upstream error details with a generic named failure", async () => {
    const operations = area(1, "Operations", false);
    loadBusinessAreasMock.mockResolvedValue([operations]);
    loadBusinessAreaAccessMock.mockResolvedValue({
      area: operations,
      canAccess: true,
      isAdmin: true,
    });
    loadBrainResourcePageMock.mockRejectedValue(
      new Error("secret_table connection string leaked"),
    );

    const overview = await loadCompanyBrainOverview("24h");
    const serialized = JSON.stringify(overview);

    expect(overview.state).toBe("partial");
    expect(overview.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: "Knowledge data could not be loaded." }),
        expect.objectContaining({ message: "Task activity could not be loaded." }),
      ]),
    );
    expect(serialized).not.toContain("secret_table");
    expect(serialized).not.toContain("connection string");
  });
});
