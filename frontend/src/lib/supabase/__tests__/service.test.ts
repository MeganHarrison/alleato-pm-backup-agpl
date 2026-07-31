const createClientMock = jest.fn((url: string, key: string) => ({ url, key }));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...(args as [string, string])),
}));

const ORIGINAL_ENV = process.env;

describe("supabase service clients", () => {
  beforeEach(() => {
    jest.resetModules();
    createClientMock.mockClear();
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "https://pm-app.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "pm-service-key",
      RAG_SUPABASE_URL: "https://ai-rag.supabase.co",
      RAG_SUPABASE_SERVICE_ROLE_KEY: "rag-service-key",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("routes Outlook intake reads to the AI/RAG Supabase project", async () => {
    const { createOutlookIntakeServiceClient } = await import("../service");

    const client = createOutlookIntakeServiceClient();

    expect(client).toMatchObject({
      url: "https://ai-rag.supabase.co",
      key: "rag-service-key",
    });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://ai-rag.supabase.co",
      "rag-service-key",
      expect.any(Object),
    );
  });

  it("fails loudly instead of falling back to the PM App database", async () => {
    delete process.env.RAG_SUPABASE_URL;

    const { createOutlookIntakeServiceClient } = await import("../service");

    expect(() => createOutlookIntakeServiceClient()).toThrow(
      /Missing RAG_SUPABASE_URL/,
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
