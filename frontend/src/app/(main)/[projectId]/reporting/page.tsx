"use client";

import { useParams } from "next/navigation";
import { PageShell } from "@/components/layout";
import { Card } from "@/components/ui/card";

export default function ProjectReportingPage() {
  const params = useParams()! ?? {};
  const projectId = params.projectId as string;

  return (
    <PageShell variant="dashboard" title="360 Reporting" description="Comprehensive project reporting and analytics">
      <Card className="p-6">
        <p className="text-muted-foreground">
          360 Reporting tool for project {projectId} - Coming soon
        </p>
      </Card>
    </PageShell>
  );
}
