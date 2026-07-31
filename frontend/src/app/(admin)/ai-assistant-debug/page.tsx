import { PageShell } from "@/components/layout";

import { AiAssistantDebugConsoleClient } from "./ai-assistant-debug-console-client";

export const dynamic = "force-dynamic";

export default function AiAssistantDebugPage() {
  return (
    <PageShell
      variant="detailXWide"
      title="AI Assistant Debug Console"
      eyebrow="Developer"
      description="Inspect routing, retrieval, tools, agents, model path, sources, and quality signals for assistant answers."
      contentClassName="space-y-6"
    >
      <AiAssistantDebugConsoleClient />
    </PageShell>
  );
}
