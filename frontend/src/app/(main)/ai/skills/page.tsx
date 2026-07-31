import { SkillLibraryList } from "@/components/ai-skills/skill-library-list";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "Skill Library | Alleato",
  description: "Approved Alleato AI skills available to the assistant.",
};

export const dynamic = "force-dynamic";

export default function AiSkillsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageShell
        variant="table"
        title="Skill Library"
        description="Approved assistant skills by category, scope, owner, reviewer, and usage."
      >
        <SkillLibraryList mode="user" endpoint="/api/ai-assistant/skills" />
      </PageShell>
    </div>
  );
}
