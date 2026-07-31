"use client";

import { useParams } from "next/navigation";
import { PageShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersTab } from "./_components/members-tab";
import { AuditLogTab } from "./_components/audit-log-tab";

export default function ProjectAdminPage() {
  const { projectId } = useParams<{ projectId: string }>()! ?? { projectId: "" };

  return (
    <PageShell
      variant="content"
      title="Project Admin"
      description="Manage member permissions for this project."
    >
      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-6">
          <MembersTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <AuditLogTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
