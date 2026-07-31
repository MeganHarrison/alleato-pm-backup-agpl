import { EmptyState } from '@/components/ds';
import { Clock } from 'lucide-react';
import type { TimelineEvent, TimelineMonthGroup } from './timeline-types';
import { TimelineMonthGroupSection } from './timeline-month-group';

function groupByMonth(events: TimelineEvent[]): TimelineMonthGroup[] {
  const map = new Map<string, TimelineMonthGroup>();

  for (const event of events) {
    const d = new Date(event.occurred_at);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (!map.has(monthKey)) {
      map.set(monthKey, { label, monthKey, events: [] });
    }
    map.get(monthKey)!.events.push(event);
  }

  // Events arrive newest-first from the DB; groups sorted the same way
  return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

interface Props {
  events: TimelineEvent[];
}

export function ProjectTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={<Clock />}
        title="No events yet"
        description="Events will appear here as the project progresses."
      />
    );
  }

  const groups = groupByMonth(events);

  return (
    <div className="max-w-2xl space-y-6">
      {groups.map((group) => (
        <TimelineMonthGroupSection key={group.monthKey} group={group} />
      ))}
    </div>
  );
}
