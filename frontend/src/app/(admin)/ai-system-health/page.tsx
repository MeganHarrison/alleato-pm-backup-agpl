import { PageShell } from "@/components/layout";
import { AiSystemHealthPanel } from "@/components/ai-intelligence/ai-system-health-panel";

export const dynamic = "force-dynamic";

export default function AiSystemHealthPage() {
  return (
    <PageShell
      variant="dashboard"
      title="AI System Health"
      description="Conversations, tokens, spend, satisfaction, model mix, the self-learning loop, and ingestion-pipeline status — one screen for stakeholder visibility into the AI."
    >
      <AiSystemHealthPanel />
    </PageShell>
  );
}
