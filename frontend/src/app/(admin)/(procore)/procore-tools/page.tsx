import { createClient } from "@/lib/supabase/server";
import {
  ProcoreToolsTableClient,
  type ProcoreToolRow,
} from "./procore-tools-table-client";

export default async function ProcoreToolsPage() {
  const supabase = await createClient();

  const { data: tools, error } = await supabase
    .from("procore_tools")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="text-center text-destructive">
        Error loading Procore tools. Please try again later.
      </div>
    );
  }

  const rows: ProcoreToolRow[] = (tools ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    category: t.category,
    status: t.status,
    description: t.description,
    new_link: t.new_link,
    procore_link: t.procore_link,
    prp_path: t.prp_path,
    tutorials: t.tutorials,
    action_buttons: t.action_buttons,
    test_results: t.test_results,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));

  return <ProcoreToolsTableClient tools={rows} />;
}
