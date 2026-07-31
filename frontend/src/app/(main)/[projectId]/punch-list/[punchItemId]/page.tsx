import { createClient } from "@/lib/supabase/server";

import { PunchItemDetail } from "./punch-item-detail";

// The shared record-detail shell is rendered by PunchItemDetail.
// eslint-disable-next-line design-system/require-page-shell
export default async function PunchItemDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; punchItemId: string }>;
}) {
  const { projectId, punchItemId } = await params;
  const numericProjectId = parseInt(projectId, 10);

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("punch_items")
    .select("*")
    .eq("id", punchItemId)
    .eq("project_id", numericProjectId)
    .single();

  return (
    <PunchItemDetail
      item={item}
      projectId={numericProjectId}
      punchItemId={punchItemId}
      loadError={error?.message}
    />
  );
}
