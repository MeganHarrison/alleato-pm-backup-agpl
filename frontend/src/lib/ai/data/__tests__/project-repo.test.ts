/**
 * Proves ProjectRepo builds the correct project-scoped queries, driven through a
 * fake ToolContext with zero import-boundary mocks. The fake db records the
 * query chain so we can assert table, filters, ordering, and limit.
 */

import {
  createProjectRepo,
  isOpenRfiStatus,
  CLOSED_RFI_STATUS,
} from "../project-repo";
import { createFakeToolContext } from "@/lib/ai/tools/tool-context";
import type { ToolContext } from "@/lib/ai/tools/tool-context";

type Call = { method: string; args: unknown[] };

// A thenable, chainable query-builder stub that records every call and resolves
// (when awaited) to the configured result.
function recordingTable(result: unknown, calls: Call[]): unknown {
  const proxy: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return (...args: unknown[]) => {
        calls.push({ method: String(prop), args });
        return proxy;
      };
    },
  });
  return proxy;
}

function fakeCtx(result: unknown, calls: Call[], tableSpy?: (t: string) => void): ToolContext {
  const from = (table: string) => {
    tableSpy?.(table);
    return recordingTable(result, calls);
  };
  return createFakeToolContext({ db: { from } as unknown as ToolContext["db"] });
}

describe("isOpenRfiStatus", () => {
  test.each([
    ["open", true],
    ["answered", true],
    ["draft", true],
    ["closed", false],
    ["Closed", false], // case-insensitive guard against status drift
    [" CLOSED ", false],
    ["closed-draft", false], // RFI closed while still in draft state
    ["Closed-Draft", false],
    ["", true], // empty string is not a recognized closed status
    [null, false],
    [undefined, false],
  ])("isOpenRfiStatus(%p) === %p", (input, expected) => {
    expect(isOpenRfiStatus(input)).toBe(expected);
  });

  test("CLOSED_RFI_STATUS is the lowercase canonical value", () => {
    expect(CLOSED_RFI_STATUS).toBe("closed");
  });
});

describe("ProjectRepo.rfisForProject", () => {
  test("queries the rfis table for the project, newest first, and returns rows", async () => {
    const calls: Call[] = [];
    let table = "";
    const rows = [{ id: 1, status: "open" }];
    const repo = createProjectRepo(fakeCtx({ data: rows, error: null }, calls, (t) => (table = t)));

    const result = await repo.rfisForProject(42);

    expect(table).toBe("rfis");
    expect(calls).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["project_id", 42] },
        { method: "order", args: ["created_at", { ascending: false }] },
      ]),
    );
    expect(result).toEqual(rows);
  });

  test("applies a fuzzy status filter when provided", async () => {
    const calls: Call[] = [];
    const repo = createProjectRepo(fakeCtx({ data: [], error: null }, calls));
    await repo.rfisForProject(42, { status: "open" });
    expect(calls).toContainEqual({ method: "ilike", args: ["status", "%open%"] });
  });

  test("throws (does not swallow) on a DB error", async () => {
    const repo = createProjectRepo(fakeCtx({ data: null, error: { message: "boom" } }, []));
    await expect(repo.rfisForProject(42)).rejects.toThrow("boom");
  });
});

describe("ProjectRepo.openRfisByDueDate", () => {
  test("scopes to projects, excludes closed and closed-draft, orders by due date", async () => {
    const calls: Call[] = [];
    const repo = createProjectRepo(fakeCtx({ data: [], error: null }, calls));
    await repo.openRfisByDueDate({ projectIds: [1, 2] });

    expect(calls).toEqual(
      expect.arrayContaining([
        { method: "in", args: ["project_id", [1, 2]] },
        { method: "neq", args: ["status", "closed"] },
        { method: "neq", args: ["status", "closed-draft"] },
        { method: "order", args: ["due_date", { ascending: true }] },
      ]),
    );
  });

  test("adds the overdue cutoff when overdueOnly and asOf are both set", async () => {
    const calls: Call[] = [];
    const repo = createProjectRepo(fakeCtx({ data: [], error: null }, calls));
    await repo.openRfisByDueDate({ projectIds: [1], overdueOnly: true, asOf: "2026-06-26" });
    expect(calls).toContainEqual({ method: "lt", args: ["due_date", "2026-06-26"] });
  });

  test("throws when overdueOnly is true but asOf is missing", async () => {
    const repo = createProjectRepo(fakeCtx({ data: [], error: null }, []));
    await expect(
      repo.openRfisByDueDate({ projectIds: [1], overdueOnly: true }),
    ).rejects.toThrow("asOf is required when overdueOnly is true");
  });

  test("omits the overdue cutoff when overdueOnly is not set", async () => {
    const calls: Call[] = [];
    const repo = createProjectRepo(fakeCtx({ data: [], error: null }, calls));
    await repo.openRfisByDueDate({ projectIds: [1] });
    expect(calls.find((c) => c.method === "lt")).toBeUndefined();
  });

  test("throws (does not swallow) on a DB error", async () => {
    const repo = createProjectRepo(fakeCtx({ data: null, error: { message: "db fail" } }, []));
    await expect(repo.openRfisByDueDate({ projectIds: [1] })).rejects.toThrow("db fail");
  });

  test("empty projectIds returns empty array without error", async () => {
    const calls: Call[] = [];
    const repo = createProjectRepo(fakeCtx({ data: [], error: null }, calls));
    const result = await repo.openRfisByDueDate({ projectIds: [] });
    expect(result).toEqual([]);
    expect(calls).toContainEqual({ method: "in", args: ["project_id", []] });
  });
});
