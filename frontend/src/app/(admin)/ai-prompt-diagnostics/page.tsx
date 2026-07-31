import { requireAdmin } from "@/app/api/admin/_shared";
import { PageShell } from "@/components/layout";

import { AiPromptDiagnosticsClient } from "./prompt-diagnostics-client";

export const dynamic = "force-dynamic";

export default async function AiPromptDiagnosticsPage() {
  await requireAdmin("ai-prompt-diagnostics-page");

  return (
    <PageShell
      variant="dashboard"
      title="AI Prompt Diagnostics"
      description="Inspect the assembled AI assistant system prompt for a representative request."
    >
      <AiPromptDiagnosticsClient />
    </PageShell>
  );
}
