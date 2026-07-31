import { PageShell } from "@/components/layout";
import { ErrorState } from "@/components/ds";
import { IdeaInboxTable } from "@/components/ideas/IdeaInboxTable";
import { listIdeas } from "@/lib/ideas/server";

export const metadata = {
  title: "Ideas | Alleato",
  description: "Quick capture and routing table for product and workflow ideas.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function IdeasPage() {
  let content;

  try {
    const ideas = await listIdeas();
    content = <IdeaInboxTable initialIdeas={ideas} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ideas could not load.";
    content = (
      <ErrorState
        title="Ideas could not load"
        error={`${message} Prevention: verify the idea_items migration is applied and Supabase service access is configured.`}
        className="items-start py-2 text-left"
      />
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <PageShell
        variant="table"
        title="Ideas"
        description="A quick editable table for ideas, routing status, and next actions."
      >
        {content}
      </PageShell>
    </div>
  );
}
