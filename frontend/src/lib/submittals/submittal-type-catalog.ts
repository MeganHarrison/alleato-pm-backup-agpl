import type { PostgrestError } from "@supabase/supabase-js";

type SubmittalTypeRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
};

export const CANONICAL_SUBMITTAL_TYPE_NAMES = [
  "Contract",
  "Document",
  "Drawings",
  "Material Samples",
  "Other",
  "Pay Request",
  "Payroll",
  "Plans",
  "Prints",
  "Product Information",
  "Product Manual",
  "Sample",
  "Specification",
] as const;

// Normalize type names so comparisons are case-insensitive and stable.
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Returns a deterministic submittal type catalog and backfills missing canonical types.
 */
export async function getNormalizedSubmittalTypeCatalog(
  supabase: {
    from: (table: string) => {
      select: (columns: string) => {
        order: (column: string) => Promise<{ data: SubmittalTypeRow[] | null; error: PostgrestError | null }>;
      };
      insert: (
        values: Array<Pick<SubmittalTypeRow, "name" | "category" | "description">>,
      ) => {
        select: (columns: string) => Promise<{ data: SubmittalTypeRow[] | null; error: PostgrestError | null }>;
      };
    };
  },
): Promise<SubmittalTypeRow[]> {
  const { data: existing, error: existingError } = await supabase
    .from("submittal_types")
    .select("id, name, category, description")
    .order("name");

  if (existingError) {
    throw existingError;
  }

  const existingRows = existing ?? [];
  const existingByName = new Map(
    existingRows.map((row) => [normalizeName(row.name), row] as const),
  );

  const missingCanonicalNames = CANONICAL_SUBMITTAL_TYPE_NAMES.filter(
    (name) => !existingByName.has(normalizeName(name)),
  );

  let insertedRows: SubmittalTypeRow[] = [];
  if (missingCanonicalNames.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("submittal_types")
      .insert(
        missingCanonicalNames.map((name) => ({
          name,
          category: "General",
          description: null,
        })),
      )
      .select("id, name, category, description");

    if (insertError) {
      throw insertError;
    }

    insertedRows = inserted ?? [];
  }

  const mergedRows = [...existingRows, ...insertedRows];
  const mergedByName = new Map(
    mergedRows.map((row) => [normalizeName(row.name), row] as const),
  );

  const canonicalRows: SubmittalTypeRow[] = CANONICAL_SUBMITTAL_TYPE_NAMES
    .map((name) => mergedByName.get(normalizeName(name)))
    .filter((row): row is SubmittalTypeRow => Boolean(row));

  const canonicalNameSet = new Set(
    CANONICAL_SUBMITTAL_TYPE_NAMES.map((name) => normalizeName(name)),
  );

  const customRows = mergedRows
    .filter((row) => !canonicalNameSet.has(normalizeName(row.name)))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...canonicalRows, ...customRows];
}
