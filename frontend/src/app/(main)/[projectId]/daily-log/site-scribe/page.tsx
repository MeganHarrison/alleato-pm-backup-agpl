export const dynamic = "force-dynamic";

import Link from "next/link";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { SiteScribeClient } from "./site-scribe-client";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function SiteScribePage({ params }: PageProps) {
  const { projectId } = await params;

  return (
    <PageShell
      variant="detailXWide"
      title="Site Scribe"
      description="Realtime AI daily-log capture for field crews."
      actions={
        <Button variant="outline" asChild>
          <Link href={`/${projectId}/daily-log`}>Back to logs</Link>
        </Button>
      }
    >
      <SiteScribeClient projectId={Number(projectId)} />
    </PageShell>
  );
}
