import { AiProfilePage } from "@/components/ai-assistant/ai-profile-page";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "AI Profile | Alleato",
  description: "Review the identity, preferences, and memories Alleato AI can use.",
};

export const dynamic = "force-dynamic";

export default function AiProfileRoute() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <PageShell
        variant="content"
        title="AI Profile"
        description="Review what Alleato AI knows about you and where to manage it."
      >
        <AiProfilePage />
      </PageShell>
    </div>
  );
}
