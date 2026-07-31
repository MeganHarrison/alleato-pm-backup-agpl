export const dynamic = "force-dynamic";

import { PageShell } from "@/components/layout";
import { serviceDb } from "@/lib/supabase/service-db";

import { RfiDetail } from "./rfi-detail";
import { RfiHeaderActions } from "./rfi-header-actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function RfiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; rfiId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { projectId, rfiId } = await params;
  const { mode } = await searchParams;
  const numericProjectId = parseInt(projectId, 10);

    const { data: rfi, error } = await serviceDb.from("rfis")
    .select("*")
    .eq("project_id", numericProjectId)
    .eq("id", rfiId)
    .single();

  if (error) {
    console.error("RFI detail fetch error:", error);
  }

  // Resolve created_by UUID to a display name
  if (rfi?.created_by && UUID_RE.test(rfi.created_by)) {
    const { data: profile } = await serviceDb.from("user_profiles")
      .select("full_name, email")
      .eq("id", rfi.created_by)
      .maybeSingle();
    if (profile) {
      rfi.created_by =
        profile.full_name?.trim() || profile.email || rfi.created_by;
    }
  }

  return (
    <PageShell
      variant="detail"
      title={rfi?.subject?.trim() || (rfi ? `RFI #${rfi.number}` : "RFI Detail")}
      actions={rfi ? <RfiHeaderActions rfi={rfi} projectId={numericProjectId} /> : undefined}
    >
      <RfiDetail
        rfi={rfi}
        projectId={numericProjectId}
        isEditing={mode === "edit"}
      />
    </PageShell>
  );
}
