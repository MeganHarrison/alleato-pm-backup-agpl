import { Heading } from "@/components/ds";
import { ARCHITECTURE_CHANGES } from "@/data/architecture-change-log.generated";
import {
  CanonicalLink,
  WorkspacePageIntro,
  WorkspaceSection,
} from "../../workspace-primitives";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

export function ArchitectureChangeLogPreview() {
  return (
    <>
      <WorkspacePageIntro
        eyebrow="Architecture Change Log"
        title="Accepted changes, with the revision and proof behind each one."
        statusLabel="Generated · accepted evidence only"
      >
        Every entry comes from a Complete task with PASS verification,
        independent approval, and an immutable published revision.
      </WorkspacePageIntro>

      <WorkspaceSection
        eyebrow="Accepted evidence"
        title="Published architecture record"
        className="mt-12"
      >
        <div className="divide-y divide-border">
          {ARCHITECTURE_CHANGES.map((change) => (
            <article
              key={change.taskId}
              className="grid gap-4 py-7 sm:grid-cols-[7rem_minmax(0,1fr)_12rem] sm:gap-8"
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(change.date)}
                </p>
                <p className="mt-2 text-xs font-medium text-primary">
                  {change.status}
                </p>
              </div>

              <div className="min-w-0">
                <Heading
                  level={5}
                  as="h2"
                  className="text-base font-semibold tracking-tight text-foreground"
                >
                  {change.title}
                </Heading>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {change.objective}
                </p>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/85">
                  {change.whyItMatters}
                </p>
              </div>

              <div className="flex flex-col items-start sm:items-end">
                <CanonicalLink href={change.issueUrl}>
                  {change.taskId}
                </CanonicalLink>
                <CanonicalLink href={change.revisionUrl}>
                  Revision {change.revision.slice(0, 10)}
                </CanonicalLink>
              </div>
            </article>
          ))}
        </div>
      </WorkspaceSection>
    </>
  );
}
