import { PageShell } from "@/components/layout";
import { DailyContentPanel } from "@/components/ai-intelligence/daily-content-panel";

export const dynamic = "force-dynamic";

export default function SourceSyncPage() {
  return (
    <PageShell
      variant="content"
      title="Pipeline Activity"
      description="One place to confirm each day's meeting transcripts, Teams messages, documents, and emails synced and vectorized into the RAG pipeline."
    >
      <DailyContentPanel />
    </PageShell>
  );
}
