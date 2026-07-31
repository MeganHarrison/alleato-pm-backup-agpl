import type { TimelineMonthGroup } from './timeline-types';
import { TimelineEventItem } from './timeline-event-item';

interface Props {
  group: TimelineMonthGroup;
}

export function TimelineMonthGroupSection({ group }: Props) {
  return (
    <section>
      <div className="sticky top-0 z-10 mb-3 bg-background py-2">
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </div>

      <div>
        {group.events.map((event, i) => (
          <TimelineEventItem
            key={`${event.kind}-${event.entity_id}-${event.occurred_at}`}
            event={event}
            isLast={i === group.events.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
