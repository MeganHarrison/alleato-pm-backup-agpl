import Link from "next/link";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default async function NewDirectCostPage({ params }: PageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;

  return (
    <PageShell
      variant="form"
      title="Direct Costs Are Read-Only"
      description="Direct costs are synced from Acumatica and cannot be created in Alleato."
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Use the sync action on the Direct Costs page to pull updates from Acumatica.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/${projectId}/direct-costs`}>Back to Direct Costs</Link>
        </Button>
      </div>
    </PageShell>
  );
}
