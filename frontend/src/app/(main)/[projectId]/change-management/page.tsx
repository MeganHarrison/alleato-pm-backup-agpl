import Link from "next/link";
import { Plus } from "lucide-react";

import { PageShell } from "@/components/layout";
import { ChangeManagementDashboard } from "@/components/domain/change-management";
import { Button } from "@/components/ui/button";

interface ChangeManagementPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ChangeManagementPage({
  params,
}: ChangeManagementPageProps) {
  const { projectId } = await params;

  return (
    <PageShell
      variant="dashboard"
      title="Change Management"
      description="Change Events identify the issue, PCOs price the impact, and Change Orders modify the contract."
      actions={
        <Button asChild size="sm">
          <Link href={`/${projectId}/change-events/new`}>
            <Plus />
            New Change Event
          </Link>
        </Button>
      }
    >
      <ChangeManagementDashboard />
    </PageShell>
  );
}
