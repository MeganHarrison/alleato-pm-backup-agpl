import { requireAdmin } from "@/app/api/admin/_shared";
import { ErrorState } from "@/components/ds";
import { PageShell } from "@/components/layout";
import { listAdminDailyBriefHistory } from "@/lib/daily-briefs/admin-history";

import { AdminDailyBriefsTable } from "./admin-daily-briefs-table";

export const dynamic = "force-dynamic";

export default async function AdminDailyBriefsPage() {
  await requireAdmin("daily-brief-admin-table-page");
  try {
    const briefs = await listAdminDailyBriefHistory();

    return <AdminDailyBriefsTable briefs={briefs} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown readback error";
    return (
      <PageShell variant="table" title="Daily Brief Operations">
        <ErrorState
          title="Daily Brief admin readback failed"
          error={`${message} Open a specific admin packet review after restoring the failed source or RAG dependency.`}
        />
      </PageShell>
    );
  }
}
