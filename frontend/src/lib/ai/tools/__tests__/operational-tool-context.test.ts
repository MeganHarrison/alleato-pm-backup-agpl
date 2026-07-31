/**
 * Proves the ToolContext seam from the test side: createOperationalTools driven
 * entirely through an injected fake ToolContext, with ZERO import-boundary
 * mocks (no jest.mock of @/lib/supabase/service or ./tool-utils). If the factory
 * still reached past its interface to build a real client, these tests could not
 * govern its behavior — so passing here is the proof that the seam is real.
 */

import { createOperationalTools } from "../operational";
import { createFakeToolContext } from "../tool-context";
import type { ToolGuardrails, ToolScope } from "../guardrails";
import type { ToolContext } from "../tool-context";

// A thenable, chainable query-builder stub. Every method returns the chainable;
// awaiting it (at .single()/.limit()/etc.) resolves to the configured result.
function chainable(result: unknown): unknown {
  const proxy: unknown = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve(result);
      }
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

function fakeGuardrails(scope: Partial<ToolScope>): ToolGuardrails {
  const full: ToolScope = {
    userId: "u-1",
    personId: "p-1",
    isAdmin: false,
    isLeadership: false,
    allowedProjectIds: [],
    allowedBusinessAreaIds: [],
    allowedCompanyIds: [],
    pinnedProjectId: null,
    ...scope,
  };
  return {
    getScope: async () => full,
    getScopedProjectIds: async (requested) => {
      if (full.allowedProjectIds.length === 0 && !full.isAdmin) return [];
      if (typeof requested === "number") return [requested];
      return full.allowedProjectIds;
    },
    getScopedBusinessAreaIds: async () => full.allowedBusinessAreaIds,
    enforceProjectAccess: async (projectId) =>
      full.isAdmin || full.allowedProjectIds.includes(projectId)
        ? { ok: true }
        : { ok: false, error: "no access" },
    enforceBusinessAreaAccess: async (businessAreaId) =>
      full.allowedBusinessAreaIds.includes(businessAreaId)
        ? { ok: true }
        : { ok: false, error: "no branch access" },
    applyPinnedProject: async () => full.pinnedProjectId,
  };
}

describe("createOperationalTools — ToolContext seam", () => {
  test("reads from the injected db + guardrails (no real client built)", async () => {
    const from = jest.fn((table: string) => {
      if (table === "projects") {
        return chainable({ data: { id: 42, name: "Injected Project" }, error: null });
      }
      if (table === "project_directory_memberships") {
        return chainable({
          data: [
            {
              role: "Project Manager",
              status: "active",
              people: { id: 7, first_name: "Ada", last_name: "Lovelace" },
            },
          ],
          error: null,
        });
      }
      return chainable({ data: [], error: null });
    });

    const ctx = createFakeToolContext({
      db: { from } as unknown as ToolContext["db"],
      guardrails: fakeGuardrails({ allowedProjectIds: [42] }),
    });

    const tools = createOperationalTools("u-1", { ctx });
    const result = (await tools.getPeopleAndRoles.execute(
      { projectId: 42 },
      { toolCallId: "t1", messages: [] },
    )) as Record<string, unknown>;

    // The factory consulted the INJECTED db — proven by it resolving the
    // injected project + membership rows rather than erroring on a missing client.
    expect(from).toHaveBeenCalledWith("projects");
    expect(from).toHaveBeenCalledWith("project_directory_memberships");
    expect(JSON.stringify(result)).toContain("Ada");
  });

  test("injected guardrails govern access; db is never touched on denial", async () => {
    const from = jest.fn();
    const ctx = createFakeToolContext({
      db: { from } as unknown as ToolContext["db"],
      guardrails: fakeGuardrails({ allowedProjectIds: [] }), // no access
    });

    const tools = createOperationalTools("u-1", { ctx });
    const result = (await tools.getPeopleAndRoles.execute(
      { projectId: 999 },
      { toolCallId: "t2", messages: [] },
    )) as Record<string, unknown>;

    expect(result.error).toMatch(/do not have access/i);
    expect(from).not.toHaveBeenCalled();
  });

  test("fake context throws when an unprovided port is used", () => {
    const ctx = createFakeToolContext({ db: {} as ToolContext["db"] });
    expect(() => (ctx.openai as unknown as { embeddings: unknown }).embeddings).toThrow(
      /not provided to the fake ToolContext/,
    );
  });
});
