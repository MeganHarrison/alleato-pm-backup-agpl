import { getProjectInfo } from "@/lib/supabase/project-fetcher";
import { EstimateDetailClientV2 } from "./estimate-detail-client-v2";
import { ErrorState } from "@/components/ds";
import { PageShell } from "@/components/layout";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

type GcItem = Database["public"]["Tables"]["estimate_gc_items"]["Row"];
type DetailItem = Database["public"]["Tables"]["estimate_detail_items"]["Row"];
type SublistSub = Database["public"]["Tables"]["estimate_sublist_subs"]["Row"];

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; estimateId: string }>;
}) {
  const { projectId, estimateId } = await params;
  const { project, supabase } = await getProjectInfo(projectId);
  const estimateIdNum = parseInt(estimateId, 10);

  // Fetch estimate
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .eq("is_deleted", false)
    .single();

  if (estimateError || !estimate) {
    return (
      <PageShell variant="detailXWide" title="Estimate not found">
        <ErrorState
          title="Estimate not found"
          description="This estimate could not be loaded for the current project."
        />
      </PageShell>
    );
  }

  // Fetch alternates
  const { data: alternates } = await supabase
    .from("estimate_alternates")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .order("sort_order", { ascending: true });

  // Fetch allowances
  const { data: allowances } = await supabase
    .from("estimate_allowances")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .order("sort_order", { ascending: true });

  // Fetch V2 data
  const { data: gcItems } = await supabase
    .from("estimate_gc_items")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .order("sort_order", { ascending: true });

  const { data: detailItems } = await supabase
    .from("estimate_detail_items")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .order("division_code", { ascending: true })
    .order("sort_order", { ascending: true });

  const { data: sublistSubs } = await supabase
    .from("estimate_sublist_subs")
    .select("*")
    .eq("estimate_id", estimateIdNum)
    .order("division_code", { ascending: true })
    .order("position", { ascending: true });

  return (
    <EstimateDetailClientV2
      projectId={projectId}
      projectName={project.name ?? `Project ${projectId}`}
      estimate={estimate}
      gcItems={(gcItems ?? []) as GcItem[]}
      detailItems={(detailItems ?? []) as DetailItem[]}
      sublistSubs={(sublistSubs ?? []) as SublistSub[]}
      alternates={alternates || []}
      allowances={allowances || []}
    />
  );
}
