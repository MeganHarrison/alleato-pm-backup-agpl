import Link from "next/link";

import { RagChatPage } from "@/components/ai-assistant/rag-chat-page";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout";
import { asrsWorkspaceTabs } from "@/lib/fmds/asrs-workspace";

export default function AsrsIntelligencePage() {
  return (
    <PageShell
      variant="table"
      title="ASRS Intelligence"
      description="Revision-scoped FMDS 8-34 engineering answers with exact table, figure, and PDF evidence."
      tabs={asrsWorkspaceTabs}
      actions={
        <Button variant="action" asChild>
          <Link href="/asrs/intake">Start assessment</Link>
        </Button>
      }
      fillHeight
      contentClassName="min-h-0"
    >
      <RagChatPage surface="asrs" />
    </PageShell>
  );
}
