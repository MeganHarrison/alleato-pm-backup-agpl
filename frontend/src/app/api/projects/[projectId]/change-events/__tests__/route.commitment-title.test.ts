import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GET } from "../route";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  createClientWithToken: jest.fn(),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

type QueryResult<T> = {
  data: T;
  error: null;
  count?: number;
};

function createQueryChain<T>(result: QueryResult<T>) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: jest.fn(
      (
        resolve: (value: QueryResult<T>) => void,
      ) => resolve(result),
    ),
  };
  return chain;
}

describe("/api/projects/[projectId]/change-events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("hydrates assigned commitment titles for change event list rows", async () => {
    const changeEventId = "11111111-1111-4111-8111-111111111111";
    const commitmentId = "22222222-2222-4222-8222-222222222222";

    const changeEventsChain = createQueryChain({
      data: [
        {
          id: changeEventId,
          project_id: 25125,
          number: "007",
          title: "Scope revision",
          type: "Owner Change",
          reason: null,
          scope: "TBD",
          status: "Open",
          origin: null,
          description: null,
          expecting_revenue: true,
          line_item_revenue_source: null,
          prime_contract_id: null,
          created_at: "2026-06-22T00:00:00.000Z",
          created_by: null,
          updated_at: null,
          updated_by: null,
          deleted_at: null,
          change_event_line_items: [{ count: 1 }],
        },
      ],
      error: null,
      count: 1,
    });
    const markupsChain = createQueryChain({ data: [], error: null });
    const lineItemsChain = createQueryChain({
      data: [
        {
          change_event_id: changeEventId,
          revenue_rom: 100,
          cost_rom: 75,
          non_committed_cost: 0,
          contract_id: null,
          commitment_id: commitmentId,
          commitment_type: "subcontract",
        },
      ],
      error: null,
    });
    const subcontractsChain = createQueryChain({
      data: [
        {
          id: commitmentId,
          contract_number: "SC-104",
          title: "Assigned Demo Subcontract",
        },
      ],
      error: null,
    });
    const rfqsChain = createQueryChain({ data: [], error: null });
    const pcoLinksChain = createQueryChain({ data: [], error: null });

    const requestFromMock = jest.fn((table: string) => {
      switch (table) {
        case "change_events":
          return changeEventsChain;
        case "vertical_markup":
          return markupsChain;
        case "change_event_line_items":
          return lineItemsChain;
        case "change_event_rfqs":
          return rfqsChain;
        case "change_event_pco_links":
          return pcoLinksChain;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });
    const serviceFromMock = jest.fn((table: string) => {
      switch (table) {
        case "subcontracts":
          return subcontractsChain;
        case "purchase_orders":
          return createQueryChain({ data: [], error: null });
        default:
          throw new Error(`Unexpected service table: ${table}`);
      }
    });

    createClientMock.mockResolvedValue({ from: requestFromMock } as never);
    createServiceClientMock.mockReturnValue({ from: serviceFromMock } as never);

    const response = await GET(
      new NextRequest("http://localhost/api/projects/25125/change-events?limit=25"),
      { params: Promise.resolve({ projectId: "25125" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [
        {
          id: changeEventId,
          // "commitment" is the committed-cost dollar amount (sum of cost_rom
          // for line items assigned to a commitment), not the contract number.
          commitment: "75.00",
          commitment_id: commitmentId,
          commitment_title: "Assigned Demo Subcontract",
        },
      ],
    });
    expect(lineItemsChain.select).toHaveBeenCalledWith(
      expect.stringContaining("commitment_id"),
    );
    expect(subcontractsChain.in).toHaveBeenCalledWith("id", [commitmentId]);
  });
});
