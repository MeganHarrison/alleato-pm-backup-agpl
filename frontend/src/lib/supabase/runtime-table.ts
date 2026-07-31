import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type RuntimeTableRow = Record<string, unknown>;

interface RuntimeTableError {
  message: string;
}

type RuntimeTableClient = SupabaseClient<Database>;

interface RuntimeRowResult {
  data: RuntimeTableRow | null;
  error: RuntimeTableError | null;
}

interface RuntimeRowsResult {
  count?: number | null;
  data: RuntimeTableRow[] | null;
  error: RuntimeTableError | null;
}

interface RuntimeTableEqualsFilter {
  column: string;
  value: string | number;
}

/** Inserts a row into a runtime-selected table and returns the inserted row. */
export async function insertRuntimeTableRow(
  supabase: RuntimeTableClient,
  table: string,
  values: RuntimeTableRow,
): Promise<RuntimeRowResult> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      insert: (payload: RuntimeTableRow) => {
        select: (columns?: string) => {
          maybeSingle: () => Promise<RuntimeRowResult>;
        };
      };
    };
  };

  return runtimeSupabase.from(table).insert(values).select("*").maybeSingle();
}

/** Updates a row in a runtime-selected table and returns the updated row. */
export async function updateRuntimeTableRow(
  supabase: RuntimeTableClient,
  table: string,
  id: string | number,
  values: RuntimeTableRow,
): Promise<RuntimeRowResult> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      update: (payload: RuntimeTableRow) => {
        eq: (column: string, value: string | number) => {
          select: (columns?: string) => {
            single: () => Promise<RuntimeRowResult>;
          };
        };
      };
    };
  };

  return runtimeSupabase.from(table).update(values).eq("id", id).select("*").single();
}

/** Deletes a row from a runtime-selected table by id. */
export async function deleteRuntimeTableRow(
  supabase: RuntimeTableClient,
  table: string,
  id: string | number,
): Promise<{ error: RuntimeTableError | null }> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      delete: () => {
        eq: (
          column: string,
          value: string | number,
        ) => Promise<{ error: RuntimeTableError | null }>;
      };
    };
  };

  return runtimeSupabase.from(table).delete().eq("id", id);
}

/** Reads selected fields from a runtime-selected table row by id. */
export async function selectRuntimeTableRow(
  supabase: RuntimeTableClient,
  table: string,
  id: string | number,
  columns: string,
): Promise<RuntimeRowResult> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      select: (selectedColumns: string) => {
        eq: (column: string, value: string | number) => {
          single: () => Promise<RuntimeRowResult>;
        };
      };
    };
  };

  return runtimeSupabase.from(table).select(columns).eq("id", id).single();
}

/** Lists rows from a runtime-selected table with optional ordering. */
export async function listRuntimeTableRows(
  supabase: RuntimeTableClient,
  table: string,
  columns = "*",
  orderBy = "created_at",
  ascending = false,
): Promise<RuntimeRowsResult> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      select: (selectedColumns?: string) => {
        order: (
          column: string,
          options?: { ascending?: boolean },
        ) => Promise<RuntimeRowsResult>;
      };
    };
  };

  return runtimeSupabase.from(table).select(columns).order(orderBy, { ascending });
}

/** Lists rows from a runtime-selected table with a single equality filter. */
export async function listRuntimeTableRowsWhereEqual(
  supabase: RuntimeTableClient,
  table: string,
  filter: RuntimeTableEqualsFilter,
  columns = "*",
): Promise<RuntimeRowsResult> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      select: (selectedColumns?: string) => {
        eq: (
          column: string,
          value: string | number,
        ) => Promise<RuntimeRowsResult>;
      };
    };
  };

  return runtimeSupabase.from(table).select(columns).eq(filter.column, filter.value);
}

/** Upserts rows into a runtime-selected table using a caller-supplied conflict key. */
export async function upsertRuntimeTableRows(
  supabase: RuntimeTableClient,
  table: string,
  values: RuntimeTableRow[],
  onConflict: string,
): Promise<RuntimeRowsResult> {
  const runtimeSupabase = supabase as unknown as {
    from: (tableName: string) => {
      upsert: (
        payload: RuntimeTableRow[],
        options: { onConflict: string },
      ) => {
        select: (columns?: string) => Promise<RuntimeRowsResult>;
      };
    };
  };

  return runtimeSupabase.from(table).upsert(values, { onConflict }).select("external_key");
}
