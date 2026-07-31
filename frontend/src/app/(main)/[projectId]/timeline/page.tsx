import { createClient } from '@/lib/supabase/server';
import { PageShell } from '@/components/layout';
import { ProjectTimeline } from '@/components/project/timeline/project-timeline';
import { notFound } from 'next/navigation';
import type { TimelineEvent } from '@/components/project/timeline/timeline-types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectTimelinePage({ params }: Props) {
  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  if (isNaN(projectIdNum)) notFound();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('project_timeline_events' as 'projects') // view not in generated types — cast to satisfy TS
    .select('occurred_at, kind, title, summary, status, entity_id, project_id')
    .eq('project_id', projectIdNum)
    .order('occurred_at', { ascending: false });

  if (error) {
    throw new Error(`Timeline query failed: ${error.message}`);
  }

  const events = (data ?? []) as unknown as TimelineEvent[];

  return (
    <PageShell
      variant="content"
      title="Timeline"
      description={
        events.length > 0
          ? `${events.length} event${events.length === 1 ? '' : 's'}`
          : undefined
      }
    >
      <ProjectTimeline events={events} />
    </PageShell>
  );
}
