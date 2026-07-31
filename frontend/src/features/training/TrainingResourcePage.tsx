import { SectionRuleHeading } from "@/components/layout";
import { InfoAlert } from "@/components/ds";
import type { TrainingResource as TrainingResourceDomain } from "@/lib/training/types";

import { resolveTrainingEmbed } from "./embed-policy";
import { TrainingPageContent } from "./TrainingDetailPage";
import { TrackedVideoPlayer } from "@/components/analytics/tracked-video-player";

const TYPE_LABEL: Record<TrainingResourceDomain["type"], string> = {
  video: "Video",
  course: "Course",
  doc: "Document",
};

const LEVEL_LABEL: Record<TrainingResourceDomain["level"], string> = {
  intro: "Intro",
  "deep-dive": "Deep dive",
};

function formatTrackLabel(track: string) {
  if (track.toLowerCase() === "pm") return "PM";
  return track
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function TrainingResourcePageContent({
  resource,
  contentItemId,
}: {
  resource: TrainingResourceDomain;
  contentItemId?: string;
}) {
  const embed =
    resolveTrainingEmbed(resource.embedUrl) ??
    resolveTrainingEmbed(resource.url);
  const lessonDetails = [
    { label: "Topic", value: resource.topicName },
    { label: "Track", value: formatTrackLabel(resource.track) },
    { label: "Format", value: TYPE_LABEL[resource.type] },
    { label: "Depth", value: LEVEL_LABEL[resource.level] },
    ...(resource.durationMinutes
      ? [{ label: "Duration", value: `${resource.durationMinutes} min` }]
      : []),
  ];

  return (
    <TrainingPageContent>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start xl:gap-12">
        <section aria-labelledby="lesson-content" className="space-y-4">
          <SectionRuleHeading
            as="h2"
            label={
              <span id="lesson-content">
                {resource.type === "video" ? "Watch" : "Read"}
              </span>
            }
          />

          {embed ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-foreground">
              {contentItemId ? <TrackedVideoPlayer contentItemId={contentItemId} title={resource.title} url={embed.url} provider={embed.provider} /> : <iframe src={embed.url} title={resource.title} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="eager" referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" />}
            </div>
          ) : (
            <InfoAlert variant="warning">
              This source does not permit an on-page reader. Its Alleato lesson
              content still needs to be authored before this page can be
              treated as complete.
            </InfoAlert>
          )}
        </section>

        <aside
          aria-label="Lesson information"
          className="space-y-8 lg:sticky lg:top-20"
        >
          <section aria-labelledby="lesson-details" className="space-y-3">
            <SectionRuleHeading
              as="h2"
              label={<span id="lesson-details">Lesson details</span>}
            />
            <dl className="divide-y divide-border/70 border-y border-border/70 text-sm">
              {lessonDetails.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[5rem_1fr] gap-3 py-3"
                >
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="source-details" className="space-y-3">
            <SectionRuleHeading
              as="h2"
              label={<span id="source-details">Source</span>}
            />
            <p className="text-sm leading-6 text-muted-foreground">
              Provided by{" "}
              {resource.provider?.trim() || "an approved source"}. The original
              link is retained for attribution.
            </p>
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-9"
            >
              View original source
            </a>
          </section>
        </aside>
      </div>
    </TrainingPageContent>
  );
}
