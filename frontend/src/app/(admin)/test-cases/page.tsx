export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { serviceDb } from "@/lib/supabase/service-db";
import type { Database } from "@/types/database.types";
import { TestCasesTableClient } from "./test-cases-table-client";

type TestCaseRow = Database["public"]["Tables"]["test_cases"]["Row"];
type TestCaseRowWithToolName = TestCaseRow & {
  tool_name: string | null;
  test_suites?: { tool_name: string } | Array<{ tool_name: string }> | null;
};
type ProcoreToolRow = Pick<Database["public"]["Tables"]["procore_tools"]["Row"], "id" | "name">;

// TestCasesPage loads test_cases data server-side and renders the unified admin table page.
export default async function TestCasesPage() {

  const { data, error } = await serviceDb.from("test_cases")
    .select(
      "id, test_number, test_name, category, subcategory, priority, test_type, gap_type, suite_id, tool, start_url, source_url, context_note, setup_steps, steps, expected_result, source_manifest_path, source_article_id, source_chunk_id, procore_feature_id, created_at, updated_at, test_suites(tool_name)",
    )
    .order("test_number", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <PageShell
        variant="table"
        title="Test Cases"
        description="Supabase test_cases records"
      >
        <div className="p-6 text-sm text-destructive">
          Failed to load test cases from Supabase: {error.message}
        </div>
      </PageShell>
    );
  }

  const { data: toolData, error: toolError } = await serviceDb.from("procore_tools")
    .select("id, name");

  if (toolError) {
    return (
      <PageShell
        variant="table"
        title="Test Cases"
        description="Supabase test_cases records"
      >
        <div className="p-6 text-sm text-destructive">
          Failed to load tool names from Supabase: {toolError.message}
        </div>
      </PageShell>
    );
  }

  const toolNamesById = new Map<number, string>(
    ((toolData ?? []) as ProcoreToolRow[]).map((tool) => [Number(tool.id), tool.name]),
  );
  const toolNamesByLowerName = new Map<string, string>(
    ((toolData ?? []) as ProcoreToolRow[]).map((tool) => [tool.name.toLowerCase(), tool.name]),
  );

  const initialRows = ((data ?? []) as TestCaseRowWithToolName[]).map((row) => {
    const suiteToolNameRaw = Array.isArray(row.test_suites)
      ? (row.test_suites[0]?.tool_name ?? null)
      : (row.test_suites?.tool_name ?? null);
    const suiteToolName = suiteToolNameRaw
      ? (toolNamesByLowerName.get(suiteToolNameRaw.toLowerCase()) ?? suiteToolNameRaw)
      : null;

    return {
      ...row,
      tool_name:
        row.tool == null
          ? suiteToolName
          : (toolNamesById.get(Number(row.tool)) ?? suiteToolName ?? null),
    };
  });

  return (
    <TestCasesTableClient
      initialRows={initialRows}
    />
  );
}
