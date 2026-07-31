import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

export interface SpecificationLookupOption {
  id: string;
  section_number: string;
  section_title: string;
  division: string | null;
  source: "specification_sections";
}

type Client = SupabaseClient<Database>;

function deriveDivisionLabel(sectionNumber: string): string | null {
  const prefix = sectionNumber.trim().slice(0, 2);
  if (!/^\d{2}$/.test(prefix)) return null;
  return `Division ${prefix}`;
}

export async function listSpecificationLookupOptions(
  supabase: Client,
  projectId: number,
): Promise<SpecificationLookupOption[]> {
  const canonical = await supabase
    .from("specification_sections")
    .select("id, section_number, title, status")
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("section_number");

  if (canonical.error) {
    throw new Error(
      `Could not load canonical specification sections: ${canonical.error.message}`,
    );
  }

  const canonicalRows: SpecificationLookupOption[] = (canonical.data ?? []).map((row) => ({
    id: String(row.id),
    section_number: row.section_number,
    section_title: row.title,
    division: deriveDivisionLabel(row.section_number),
    source: "specification_sections",
  }));

  return canonicalRows;
}
