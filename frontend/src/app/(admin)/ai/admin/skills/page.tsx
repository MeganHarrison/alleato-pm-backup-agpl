import { requireAdmin } from "@/app/api/admin/_shared";
import { SkillLibraryList } from "@/components/ai-skills/skill-library-list";
import { PageShell } from "@/components/layout";

export const metadata = {
  title: "AI Skills | Alleato",
  description: "Admin review surface for Skill Library records.",
};

export const dynamic = "force-dynamic";

export default async function AdminAiSkillsPage() {
  await requireAdmin("admin.ai-skills.page");

  return (
    <PageShell
      variant="table"
      title="AI Skills"
      description="Review Skill Library records by status, scope, owner, reviewer, and usage."
    >
      <SkillLibraryList mode="admin" endpoint="/api/admin/ai-skills" />
    </PageShell>
  );
}
