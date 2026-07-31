import type { FeatureRequestEventRow } from "@/lib/feature-requests/types";

export function RequestTimeline({ events }: { events: FeatureRequestEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity has been recorded yet.</p>;
  }

  return (
    <ol className="divide-y divide-border/70">
      {events.map((event) => (
        <li key={event.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-foreground">{event.title}</div>
              <div className="text-xs text-muted-foreground">{event.event_type.replaceAll("_", " ")}</div>
            </div>
            <time className="text-xs text-muted-foreground">
              {new Date(event.created_at).toLocaleString()}
            </time>
          </div>
          {event.body ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {event.body}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
