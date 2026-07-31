process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

import { NextRequest } from "next/server";

import { PATCH } from "../route";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
  getApiRouteUser: jest.fn().mockResolvedValue({ id: "user-1" }),
}));

jest.mock("@/lib/supabase/service", () => ({
  createServiceClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<
  typeof createClient
>;
const createServiceClientMock = createServiceClient as jest.MockedFunction<
  typeof createServiceClient
>;

function makePatchRequest(documentType: string | null) {
  return new NextRequest("http://localhost/api/document-picker/linked", {
    method: "PATCH",
    body: JSON.stringify({
      entityType: "commitment",
      entityId: "subcontract-1",
      documentMetadataId: "doc-1",
      documentType,
    }),
  });
}

function buildSupabaseClient({
  taxonomyFound = true,
}: {
  taxonomyFound?: boolean;
} = {}) {
  const subcontractLookup = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: "subcontract-1" }, error: null }),
  };
  subcontractLookup.select.mockReturnValue(subcontractLookup);
  subcontractLookup.eq.mockReturnValue(subcontractLookup);
  const purchaseOrderLookup = {
    select: jest.fn(),
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
  purchaseOrderLookup.select.mockReturnValue(purchaseOrderLookup);
  purchaseOrderLookup.eq.mockReturnValue(purchaseOrderLookup);
  const taxonomyLookup = {
    select: jest.fn(),
    eq: jest.fn(),
    contains: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: taxonomyFound ? { type_key: "w9" } : null,
      error: null,
    }),
  };
  taxonomyLookup.select.mockReturnValue(taxonomyLookup);
  taxonomyLookup.eq.mockReturnValue(taxonomyLookup);
  taxonomyLookup.contains.mockReturnValue(taxonomyLookup);
  const subcontractDocumentsUpdate = {
    update: jest.fn(),
    eq: jest.fn(),
  };
  subcontractDocumentsUpdate.update.mockReturnValue(subcontractDocumentsUpdate);
  subcontractDocumentsUpdate.eq.mockReturnValue(subcontractDocumentsUpdate);
  const metadataUpdate = {
    update: jest.fn(),
    eq: jest.fn(),
  };
  metadataUpdate.update.mockReturnValue(metadataUpdate);
  metadataUpdate.eq.mockReturnValue(metadataUpdate);

  const client = {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
    from: jest.fn((table: string) => {
      if (table === "subcontracts") return subcontractLookup;
      if (table === "purchase_orders") return purchaseOrderLookup;
      if (table === "document_type_taxonomy") return taxonomyLookup;
      if (table === "subcontract_documents") return subcontractDocumentsUpdate;
      if (table === "document_metadata") return metadataUpdate;
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  } as Awaited<ReturnType<typeof createClient>>;

  return {
    client,
    metadataUpdate,
    subcontractDocumentsUpdate,
    taxonomyLookup,
  };
}

describe("document picker linked route PATCH", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createServiceClientMock.mockReturnValue({} as ReturnType<typeof createServiceClient>);
  });

  it("updates the linked row and document metadata type", async () => {
    const supabase = buildSupabaseClient();
    createClientMock.mockResolvedValue(supabase.client);

    const response = await PATCH(makePatchRequest("w9"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        entityType: "subcontract",
        documentMetadataId: "doc-1",
        documentType: "w9",
      }),
    );
    expect(supabase.taxonomyLookup.contains).toHaveBeenCalledWith("applies_to", ["commitment"]);
    expect(supabase.subcontractDocumentsUpdate.update).toHaveBeenCalledWith({ document_type: "w9" });
    expect(supabase.metadataUpdate.update).toHaveBeenCalledWith({ document_type: "w9" });
  });

  it("rejects document types that do not apply to commitment attachments before updating", async () => {
    const supabase = buildSupabaseClient({ taxonomyFound: false });
    createClientMock.mockResolvedValue(supabase.client);

    const response = await PATCH(makePatchRequest("unsupported"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: 'Document type "unsupported" is not available for commitment attachments.',
      }),
    );
    expect(supabase.subcontractDocumentsUpdate.update).not.toHaveBeenCalled();
    expect(supabase.metadataUpdate.update).not.toHaveBeenCalled();
  });
});
