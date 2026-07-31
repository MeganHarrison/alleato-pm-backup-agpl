import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveChangeEventBudgetLineId } from "@/lib/change-events/budget-line-resolver";
import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

type Row = Record<string, unknown>;
type Tables = {
  budget_lines: Row[];
  project_budget_codes: Row[];
};

class QueryBuilder {
  private filters: Array<{ column: string; value: unknown }> = [];
  private nullFilters: string[] = [];
  private insertPayload: Row | null = null;

  constructor(
    private readonly table: keyof Tables,
    private readonly tables: Tables,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: null) {
    if (value === null) {
      this.nullFilters.push(column);
    }
    return this;
  }

  insert(payload: Row) {
    this.insertPayload = payload;
    return this;
  }

  async maybeSingle() {
    const rows = this.matchingRows();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    if (this.insertPayload) {
      const row = { id: "created-budget-line", ...this.insertPayload };
      this.tables[this.table].push(row);
      return { data: row, error: null };
    }

    const rows = this.matchingRows();
    return { data: rows[0] ?? null, error: null };
  }

  private matchingRows() {
    return this.tables[this.table].filter((row) => {
      const eqMatches = this.filters.every(({ column, value }) => row[column] === value);
      const nullMatches = this.nullFilters.every((column) => row[column] === null);
      return eqMatches && nullMatches;
    });
  }
}

function createSupabaseMock(tables: Tables): SupabaseClient<Database> {
  return {
    from(table: keyof Tables) {
      return new QueryBuilder(table, tables);
    },
  } as unknown as SupabaseClient<Database>;
}

describe("resolveChangeEventBudgetLineId", () => {
  it("returns a matching budget_lines.id directly", async () => {
    const supabase = createSupabaseMock({
      budget_lines: [{ id: "budget-line-1", project_id: 42 }],
      project_budget_codes: [],
    });

    await expect(
      resolveChangeEventBudgetLineId({
        supabase,
        projectId: 42,
        inputId: "budget-line-1",
        where: "test",
      }),
    ).resolves.toBe("budget-line-1");
  });

  it("resolves a project_budget_codes.id through budget_lines.project_budget_code_id", async () => {
    const supabase = createSupabaseMock({
      budget_lines: [
        {
          id: "budget-line-1",
          project_id: 42,
          project_budget_code_id: "project-budget-code-1",
        },
      ],
      project_budget_codes: [
        {
          id: "project-budget-code-1",
          project_id: 42,
          cost_code_id: "cost-code-1",
          cost_type_id: "cost-type-1",
          sub_job_id: null,
        },
      ],
    });

    await expect(
      resolveChangeEventBudgetLineId({
        supabase,
        projectId: 42,
        inputId: "project-budget-code-1",
        where: "test",
      }),
    ).resolves.toBe("budget-line-1");
  });

  it("rejects a budget line from another project", async () => {
    const supabase = createSupabaseMock({
      budget_lines: [{ id: "budget-line-1", project_id: 7 }],
      project_budget_codes: [],
    });

    await expect(
      resolveChangeEventBudgetLineId({
        supabase,
        projectId: 42,
        inputId: "budget-line-1",
        where: "test",
      }),
    ).rejects.toThrow(GuardrailError);
  });

  it("creates a budget line when a valid project budget code has no budget row", async () => {
    const tables: Tables = {
      budget_lines: [],
      project_budget_codes: [
        {
          id: "project-budget-code-1",
          project_id: 42,
          cost_code_id: "cost-code-1",
          cost_type_id: "cost-type-1",
          sub_job_id: null,
        },
      ],
    };

    const supabase = createSupabaseMock(tables);

    await expect(
      resolveChangeEventBudgetLineId({
        supabase,
        projectId: 42,
        inputId: "project-budget-code-1",
        where: "test",
      }),
    ).resolves.toBe("created-budget-line");

    expect(tables.budget_lines).toContainEqual({
      id: "created-budget-line",
      project_id: 42,
      project_budget_code_id: "project-budget-code-1",
      cost_code_id: "cost-code-1",
      cost_type_id: "cost-type-1",
      sub_job_id: null,
    });
  });
});
