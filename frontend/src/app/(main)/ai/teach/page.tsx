import { TeachAlleatoIntake } from "@/components/ai-assistant/teach-alleato-intake";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "Teach Alleato | Alleato",
  description: "Submit reviewed workflow knowledge for Alleato AI.",
};

export default function AiTeachPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background">
      <PageShell
        variant="content"
        title="Teach Alleato"
        description="Submissions become review candidates before they change assistant behavior."
      >
        <TeachAlleatoIntake />
      </PageShell>
    </div>
  );
}
