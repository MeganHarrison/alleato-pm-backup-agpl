process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { GET } from "../route";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function buildTaxonomyQuery() {
  const query = {
    select: jest.fn(),
    eq: jest.fn(),
    contains: jest.fn(),
    order: jest.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.contains.mockReturnValue(query);
  query.order.mockReturnValueOnce(query);
  query.order.mockResolvedValueOnce({
    data: [
      {
        type_key: "change_order",
        display_name: "Change Order",
        category: "financial",
        sort_order: 320,
      },
    ],
    error: null,
  });
  return query;
}

describe("document picker types route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads taxonomy options for change event attachments", async () => {
    const taxonomyQuery = buildTaxonomyQuery();
    createClientMock.mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "document_type_taxonomy") return taxonomyQuery;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as Awaited<ReturnType<typeof createClient>>);

    const response = await GET(
      new NextRequest("http://localhost/api/document-picker/types?for=change_event"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        type_key: "change_order",
        display_name: "Change Order",
        category: "financial",
        sort_order: 320,
      },
    ]);
    expect(taxonomyQuery.contains).toHaveBeenCalledWith("applies_to", ["change_event"]);
  });
});
