import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { ErrorState } from "@/components/ds";
import { MeetingsTablePage } from "@/features/meetings/meetings-table-page";
import { StructuredMeetingsTablePage } from "@/features/meetings/structured-meetings-table-page";
import { meetingsSchema } from "@/lib/validation/meetings";
import { TablePageWrapper } from "@/components/tables/table-page-wrapper";
import { getProjectInfo } from "@/lib/supabase/project-fetcher";
import { Button } from "@/components/ui/button";

const PAGE_TITLE = "Meetings";
const PAGE_DESCRIPTION = "View and manage project meetings";

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function ProjectMeetingsPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { tab } = await searchParams;
  const { numericProjectId } = await getProjectInfo(projectId);

  const activeTab = tab === "transcripts" ? "transcripts" : "meetings";

  const tabs = [
    {
      label: "Meetings",
      href: `/${projectId}/meetings`,
      isActive: activeTab === "meetings",
    },
    {
      label: "Transcripts",
      href: `/${projectId}/meetings?tab=transcripts`,
      isActive: activeTab === "transcripts",
    },
  ];

  const actions = (
    <Button asChild>
      <Link href={`/${projectId}/meetings/new`}>Create meeting</Link>
    </Button>
  );

  // Default "Meetings" tab: the structured tool (agendas + minutes) — this is
  // where a manually created meeting lands, so it is the primary view.
  if (activeTab === "meetings") {
    return (
      <StructuredMeetingsTablePage
        projectId={projectId}
        headerActions={actions}
        tabs={tabs}
      />
    );
  }

  // "Transcripts" tab: synced Fireflies/Teams recordings from document_metadata.
  const supabase = await createClient();

  const { data: meetings, error } = await supabase
    .from("document_metadata")
    .select("*")
    .eq("project_id", numericProjectId)
    .eq("type", "meeting")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (error) {
    return (
      <TablePageWrapper
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={actions}
      >
        <ErrorState error="Error loading meetings. Please try again later." />
      </TablePageWrapper>
    );
  }

  const parsed = meetingsSchema.safeParse(meetings ?? []);
  if (!parsed.success) {
    return (
      <TablePageWrapper
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={actions}
      >
        <ErrorState error="Error loading meetings. Please try again later." />
      </TablePageWrapper>
    );
  }

  return (
    <MeetingsTablePage
      initialMeetings={parsed.data}
      projectId={projectId}
      headerActions={actions}
      tabs={tabs}
    />
  );
}
