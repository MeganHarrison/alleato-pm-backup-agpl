jest.mock("ai", () => ({
  tool: <T>(definition: T) => definition,
}));

import { isDocumentScopeAllowed, type ToolScope } from "../guardrails";
import { createRagSearchReadTools } from "../read/rag-search-tools";

const scope: ToolScope = {
  userId: "user-1",
  personId: "person-1",
  isAdmin: false,
  isLeadership: false,
  allowedProjectIds: [60],
  allowedBusinessAreaIds: [17, 18],
  allowedCompanyIds: [],
  pinnedProjectId: null,
};

describe("Business Area search guardrails", () => {
  it("requires an exact requested Business Area match", () => {
    expect(
      isDocumentScopeAllowed({
        scope,
        projectId: 60,
        metadata: { business_area_id: 17 },
        requestedBusinessAreaId: 17,
      }),
    ).toBe(true);

    expect(
      isDocumentScopeAllowed({
        scope,
        projectId: 60,
        metadata: { business_area_id: 18 },
        requestedBusinessAreaId: 17,
      }),
    ).toBe(false);
  });

  it("does not let a retained project label satisfy a branch request", () => {
    expect(
      isDocumentScopeAllowed({
        scope,
        projectId: 60,
        metadata: {},
        requestedBusinessAreaId: 17,
      }),
    ).toBe(false);
  });

  it("fails closed when both typed scopes are requested", () => {
    expect(
      isDocumentScopeAllowed({
        scope,
        projectId: 60,
        metadata: { business_area_id: 17 },
        requestedProjectId: 60,
        requestedBusinessAreaId: 17,
      }),
    ).toBe(false);
  });

  it("rejects a Business Area search in pinned project context before retrieval", async () => {
    const getScope = jest.fn().mockResolvedValue({
      ...scope,
      pinnedProjectId: 60,
    });
    const enforceBusinessAreaAccess = jest.fn();
    const rpc = jest.fn();
    const tools = createRagSearchReadTools({
      options: {},
      ctx: {},
      supabase: { rpc },
      ragSupabase: { rpc },
      guardrails: {
        getScope,
        enforceBusinessAreaAccess,
      },
    } as never);

    const result = await tools.semanticSearch.execute(
      { query: "quarterly forecast", businessAreaId: 17, limit: 15 },
      { toolCallId: "pinned-branch-xor", messages: [] },
    );

    expect(result).toEqual({
      error:
        "Choose either a project or an Alleato Brain branch for semantic search, not both.",
    });
    expect(enforceBusinessAreaAccess).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
