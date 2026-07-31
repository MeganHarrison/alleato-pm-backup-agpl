/**
 * Content Source module tests.
 *
 * These pin the exact three failure modes that caused the "RAG → full
 * transcripts" breakage, through the module's interface with injected fake
 * clients (no live DB):
 *   1. window filtering  — the forked date-predicate that drifted per copy
 *   2. int8-as-string     — the "every project renders Unassigned" regression
 *   3. lane → column      — meeting/email/teams/document map to the right filter
 *
 * The window semantics are shared with `content-window.ts` (lifted verbatim from
 * the daily-brief consumer this module replaces first), so keeping the module's
 * output equal to `isWithinWindow` over the fixtures is the parity assertion.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getProjectContent } from "@/lib/intelligence/content-source";
import { isWithinWindow, type ContentWindow } from "@/lib/intelligence/content-window";

type Row = Record<string, unknown>;

interface FakeState {
  table: string;
  filters: Array<[string, unknown]>;
  inFilter: [string, unknown[]] | null;
}

/** A chainable Supabase fake that resolves from fixture tables. */
function makeFakeClient(tables: {
  document_metadata: Row[];
  projects: Row[];
}): SupabaseClient<Database> {
  const resolve = (state: FakeState) => {
    if (state.table === "projects") {
      const [, ids] = state.inFilter ?? ["id", []];
      const wanted = new Set((ids as unknown[]).map((v) => String(v)));
      return { data: tables.projects.filter((p) => wanted.has(String(p.id))), error: null };
    }
    if (state.table === "document_metadata") {
      const data = tables.document_metadata.filter((row) =>
        state.filters.every(([col, val]) => String(row[col]) === String(val)),
      );
      return { data, error: null };
    }
    return { data: [], error: null };
  };

  const client = {
    from(table: string) {
      const state: FakeState = { table, filters: [], inFilter: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: string, v: unknown) => {
          state.filters.push([c, v]);
          return chain;
        },
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        in: (c: string, v: unknown[]) => {
          state.inFilter = [c, v];
          return chain;
        },
        then: (onF: (r: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve(resolve(state)).then(onF, onR),
      };
      return chain;
    },
  };
  return client as unknown as SupabaseClient<Database>;
}

const WINDOW: ContentWindow = {
  since: "2026-07-06T00:00:00.000Z",
  until: "2026-07-09T23:59:59.999Z",
};

function meetingRow(over: Row): Row {
  return {
    type: "meeting",
    category: "meeting",
    project_id: 7,
    title: "Untitled",
    summary: "sum",
    overview: "ov",
    content: "full transcript body",
    raw_text: null,
    url: null,
    source_web_url: null,
    date: null,
    captured_at: null,
    created_at: null,
    ...over,
  };
}

const PROJECTS: Row[] = [
  { id: 7, name: "Noblesville" },
  { id: 42, name: "Superior Beverage" },
];

describe("getProjectContent — window filtering", () => {
  it("keeps only rows inside the window, matching isWithinWindow exactly", async () => {
    const rows = [
      meetingRow({ id: "in-1", date: "2026-07-08" }),
      meetingRow({ id: "in-2", date: "2026-07-06" }),
      meetingRow({ id: "out-old", date: "2026-07-01" }),
      meetingRow({ id: "out-future", date: "2026-07-20" }),
    ];
    const client = makeFakeClient({ document_metadata: rows, projects: PROJECTS });

    const items = await getProjectContent(
      { window: WINDOW, granularity: "full", sourceTypes: ["meeting"] },
      { pmClient: client },
    );

    const expected = rows.filter((r) => isWithinWindow(r, WINDOW)).map((r) => r.id).sort();
    expect(items.map((i) => i.documentId).sort()).toEqual(expected);
    expect(expected).toEqual(["in-1", "in-2"]);
  });
});

describe("getProjectContent — int8-as-string coercion (the 'all Unassigned' regression)", () => {
  it("resolves a project name even when project_id arrives as a string", async () => {
    const rows = [
      meetingRow({ id: "m-str", date: "2026-07-08", project_id: "42" }),
    ];
    const client = makeFakeClient({ document_metadata: rows, projects: PROJECTS });

    const items = await getProjectContent(
      { window: WINDOW, granularity: "full", sourceTypes: ["meeting"] },
      { pmClient: client },
    );

    expect(items).toHaveLength(1);
    expect(items[0].projectId).toBe(42);
    expect(items[0].projectName).toBe("Superior Beverage");
  });
});

describe("getProjectContent — project_id = 0 is the 'unassigned' sentinel, not an FK", () => {
  it("maps project_id 0 to null projectId/projectName and never looks it up", async () => {
    const rows = [meetingRow({ id: "m-zero", date: "2026-07-08", project_id: 0 })];
    const client = makeFakeClient({ document_metadata: rows, projects: PROJECTS });

    const items = await getProjectContent(
      { window: WINDOW, granularity: "full", sourceTypes: ["meeting"] },
      { pmClient: client },
    );

    expect(items).toHaveLength(1);
    expect(items[0].projectId).toBeNull();
    expect(items[0].projectName).toBeNull();
  });
});

describe("getProjectContent — lane → column mapping", () => {
  it("selects email rows by category, not type", async () => {
    const rows = [
      { ...meetingRow({ id: "a-meeting", date: "2026-07-08" }) },
      {
        ...meetingRow({ id: "b-email", date: "2026-07-08" }),
        type: "email",
        category: "email",
      },
    ];
    const client = makeFakeClient({ document_metadata: rows, projects: PROJECTS });

    const items = await getProjectContent(
      { window: WINDOW, granularity: "full", sourceTypes: ["email"] },
      { pmClient: client },
    );

    expect(items.map((i) => i.documentId)).toEqual(["b-email"]);
    expect(items[0].sourceType).toBe("email");
  });
});

describe("getProjectContent — granularity picks the text field", () => {
  it("summary uses summary/overview; full uses content", async () => {
    const rows = [meetingRow({ id: "g", date: "2026-07-08" })];
    const client = makeFakeClient({ document_metadata: rows, projects: PROJECTS });

    const [full] = await getProjectContent(
      { window: WINDOW, granularity: "full", sourceTypes: ["meeting"] },
      { pmClient: client },
    );
    const [summary] = await getProjectContent(
      { window: WINDOW, granularity: "summary", sourceTypes: ["meeting"] },
      { pmClient: client },
    );
    expect(full.text).toBe("full transcript body");
    expect(summary.text).toBe("sum");
  });
});

describe("getProjectContent — chunks granularity requires a query", () => {
  it("throws loudly rather than silently returning []", async () => {
    const client = makeFakeClient({ document_metadata: [], projects: PROJECTS });
    await expect(
      getProjectContent({ window: WINDOW, granularity: "chunks" }, { pmClient: client }),
    ).rejects.toThrow(/requires a `query`/);
  });
});
