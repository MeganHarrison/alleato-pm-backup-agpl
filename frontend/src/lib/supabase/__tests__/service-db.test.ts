const createClientMock = jest.fn((url: string, key: string) => ({
  url,
  key,
  from: (relation: string) => ({ __project: { url, key }, relation }),
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) =>
    createClientMock(...(args as [string, string])),
}));

const ORIGINAL_ENV = process.env;

const PM_URL = "https://pm-app.supabase.co";
const RAG_URL = "https://ai-rag.supabase.co";

// Runtime validation instead of a cast: read the project url the mock stamped
// onto the returned builder, narrowing from `unknown` with plain type guards.
function projectUrlOf(builder: unknown): string {
  if (typeof builder !== "object" || builder === null || !("__project" in builder)) {
    throw new Error("mock builder is missing __project");
  }
  const project = builder.__project;
  if (
    typeof project !== "object" ||
    project === null ||
    !("url" in project) ||
    typeof project.url !== "string"
  ) {
    throw new Error("mock builder is missing __project.url");
  }
  return project.url;
}

describe("serviceDb — table → Supabase project router", () => {
  beforeEach(() => {
    jest.resetModules();
    createClientMock.mockClear();
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: PM_URL,
      SUPABASE_SERVICE_ROLE_KEY: "pm-service-key",
      RAG_SUPABASE_URL: RAG_URL,
      RAG_SUPABASE_SERVICE_ROLE_KEY: "rag-service-key",
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("routes an AI-Database table to the RAG project", async () => {
    const { serviceDb } = await import("../service-db");

    expect(projectUrlOf(serviceDb.from("document_chunks"))).toBe(RAG_URL);
  });

  it("routes a PM-App table to the PM-App project", async () => {
    const { serviceDb } = await import("../service-db");

    expect(projectUrlOf(serviceDb.from("projects"))).toBe(PM_URL);
  });

  it("routes accounting source tables to the PM-App project", async () => {
    const { serviceDb } = await import("../service-db");

    expect(projectUrlOf(serviceDb.from("acumatica_checks"))).toBe(PM_URL);
    expect(projectUrlOf(serviceDb.from("acumatica_ap_bills"))).toBe(PM_URL);
    expect(projectUrlOf(serviceDb.from("acumatica_project_budgets"))).toBe(
      PM_URL,
    );
  });

  it("routes executive source tables to the PM-App project", async () => {
    const { serviceDb } = await import("../service-db");

    expect(projectUrlOf(serviceDb.from("daily_recaps"))).toBe(PM_URL);
    expect(projectUrlOf(serviceDb.from("intelligence_packets"))).toBe(PM_URL);
    expect(projectUrlOf(serviceDb.from("intelligence_targets"))).toBe(PM_URL);
  });

  it("routes feedback catalog tables to the PM-App project", async () => {
    const { serviceDb } = await import("../service-db");

    expect(projectUrlOf(serviceDb.from("procore_tools"))).toBe(PM_URL);
  });

  it("routes outlook intake tables to the RAG project (the historical mistype)", async () => {
    const { serviceDb } = await import("../service-db");

    expect(projectUrlOf(serviceDb.from("outlook_email_intake"))).toBe(RAG_URL);
  });

  it("throws when RAG is unconfigured instead of routing to the PM App project", async () => {
    delete process.env.RAG_SUPABASE_URL;

    const { serviceDb } = await import("../service-db");

    expect(() => serviceDb.from("document_chunks")).toThrow(
      /Missing RAG_SUPABASE_URL/,
    );
  });

  it("memoizes each project client across calls", async () => {
    const { serviceDb } = await import("../service-db");

    serviceDb.from("projects");
    serviceDb.from("projects");
    serviceDb.from("document_chunks");
    serviceDb.from("rag_document_metadata");

    // one PM client + one RAG client, not one per call
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the registry membership check in sync with the exported set", async () => {
    const { isRagTable, RAG_TABLE_NAMES, RAG_TABLE_REGISTRY } = await import(
      "../service-db"
    );

    expect(isRagTable("document_chunks")).toBe(true);
    expect(isRagTable("rag_document_metadata")).toBe(true);
    expect(isRagTable("projects")).toBe(false);
    expect(RAG_TABLE_REGISTRY.size).toBe(RAG_TABLE_NAMES.length);
  });
});
