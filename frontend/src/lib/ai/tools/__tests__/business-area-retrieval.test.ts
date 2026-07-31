import {
  createToolGuardrails,
  isCommunicationSourceAllowed,
  isDocumentScopeAllowed,
  readDocumentBusinessAreaScope,
  resolveAllowedBusinessAreaIds,
  resolveCommunicationSourceType,
  type ToolScope,
} from "../guardrails";

function scopeQueryResult(result: unknown): unknown {
  const proxy: unknown = new Proxy(function () {}, {
    get(_target, property) {
      if (property === "then") {
        return (resolve: (value: unknown) => void) => resolve(result);
      }
      return () => proxy;
    },
  });
  return proxy;
}

function scopeClient(
  results: Record<string, { data: unknown; error: { message: string } | null }>,
) {
  return {
    from: jest.fn((table: string) =>
      scopeQueryResult(
        results[table] ?? {
          data: [],
          error: null,
        },
      ),
    ),
  };
}

const BUSINESS_AREAS = [
  { id: 1, is_restricted: false },
  { id: 2, is_restricted: false },
  { id: 3, is_restricted: true },
  { id: 4, is_restricted: false },
  { id: 5, is_restricted: false },
];

function scope(overrides: Partial<ToolScope> = {}): ToolScope {
  return {
    userId: "user-1",
    personId: "person-1",
    isAdmin: false,
    isLeadership: false,
    allowedProjectIds: [],
    allowedBusinessAreaIds: [1, 2, 4, 5],
    allowedCompanyIds: [],
    pinnedProjectId: null,
    ...overrides,
  };
}

describe("Business Area tool scope", () => {
  it("allows unrestricted branches but keeps Finance fail-closed without membership", () => {
    expect(
      resolveAllowedBusinessAreaIds({
        businessAreas: BUSINESS_AREAS,
        activeMembershipIds: new Set(),
        isAdmin: false,
      }),
    ).toEqual([1, 2, 4, 5]);
  });

  it("allows a restricted branch only with active membership or admin scope", () => {
    expect(
      resolveAllowedBusinessAreaIds({
        businessAreas: BUSINESS_AREAS,
        activeMembershipIds: new Set([3]),
        isAdmin: false,
      }),
    ).toEqual([1, 2, 3, 4, 5]);

    expect(
      resolveAllowedBusinessAreaIds({
        businessAreas: BUSINESS_AREAS,
        activeMembershipIds: new Set(),
        isAdmin: true,
      }),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("fails loudly when the user authorization profile cannot be loaded", async () => {
    const db = scopeClient({
      users_auth: { data: { person_id: "person-1" }, error: null },
      user_profiles: {
        data: null,
        error: { message: "profile read denied" },
      },
    });

    await expect(
      createToolGuardrails("user-1", { db: db as never }).getScope(),
    ).rejects.toThrow(
      "Failed to load user authorization profile: profile read denied",
    );
  });

  it("fails loudly when branch membership scope cannot be loaded", async () => {
    const db = scopeClient({
      users_auth: { data: { person_id: "person-1" }, error: null },
      user_profiles: {
        data: { is_admin: false, is_leadership: false },
        error: null,
      },
      business_areas: { data: BUSINESS_AREAS, error: null },
      business_area_memberships: {
        data: null,
        error: { message: "membership read denied" },
      },
    });

    await expect(
      createToolGuardrails("user-1", { db: db as never }).getScope(),
    ).rejects.toThrow(
      "Failed to load Business Area memberships: membership read denied",
    );
  });
});

describe("Business Area chunk authorization", () => {
  it("uses the branch label instead of a retained legacy project label", () => {
    const projectMember = scope({ allowedProjectIds: [60] });

    expect(
      isDocumentScopeAllowed({
        scope: projectMember,
        projectId: 60,
        metadata: { business_area_id: 3 },
      }),
    ).toBe(false);

    expect(
      isDocumentScopeAllowed({
        scope: scope({ allowedProjectIds: [89] }),
        projectId: 89,
        metadata: { business_area_id: 5 },
      }),
    ).toBe(true);
  });

  it("excludes company-branch chunks from a project-pinned search", () => {
    expect(
      isDocumentScopeAllowed({
        scope: scope({
          allowedProjectIds: [89],
          allowedBusinessAreaIds: [5],
        }),
        projectId: 89,
        metadata: { business_area_id: 5 },
        requestedProjectId: 89,
      }),
    ).toBe(false);
  });

  it("fails closed for malformed branch labels instead of falling back to project scope", () => {
    const malformed = { business_area_id: "3" };
    expect(readDocumentBusinessAreaScope(malformed)).toEqual({
      kind: "invalid",
      rawValue: "3",
    });
    expect(
      isDocumentScopeAllowed({
        scope: scope({ allowedProjectIds: [60] }),
        projectId: 60,
        metadata: malformed,
      }),
    ).toBe(false);
  });

  it("preserves ordinary project authorization for records without a branch", () => {
    expect(
      isDocumentScopeAllowed({
        scope: scope({ allowedProjectIds: [1009] }),
        projectId: 1009,
        metadata: {},
      }),
    ).toBe(true);
  });
});

describe("Business Area communication retrieval", () => {
  it("allows authorized branch communications without widening project communications", () => {
    const userScope = scope({ allowedBusinessAreaIds: [5] });

    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: "email",
        metadata: { business_area_id: 5 },
      }),
    ).toBe(true);
    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: "email",
        metadata: { project_id: 1009 },
      }),
    ).toBe(false);
    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: "teams_dm",
        metadata: { business_area_id: 5 },
      }),
    ).toBe(true);
    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: "teams_dm",
        metadata: { project_id: 1009 },
      }),
    ).toBe(false);
    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: "teams_dm",
        metadata: { business_area_id: 3 },
      }),
    ).toBe(false);
  });

  it("uses document category when Microsoft Graph is the generic source type", () => {
    const userScope = scope({
      allowedProjectIds: [1009],
      allowedBusinessAreaIds: [5],
    });
    const graphTeamsType = resolveCommunicationSourceType({
      category: "teams_message",
      sourceType: "microsoft_graph",
    });

    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: graphTeamsType,
        metadata: { project_id: 1009 },
      }),
    ).toBe(false);
    expect(
      isCommunicationSourceAllowed({
        scope: userScope,
        sourceType: graphTeamsType,
        metadata: { business_area_id: 5 },
      }),
    ).toBe(true);
  });
});
