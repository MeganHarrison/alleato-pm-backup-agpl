import { notFound, redirect } from "next/navigation";

import { TrackedVideoPlayer } from "@/components/analytics/tracked-video-player";
import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { PageShell, SectionRuleHeading } from "@/components/layout";
import { attributedDocsHref } from "@/lib/analytics/docs-link";
import { getLearningContent } from "@/lib/learning/server";

export default async function LearningContentPage({
  params,
}: {
  params: Promise<{ contentId: string }>;
}) {
  const { contentId } = await params;
  const content = await getLearningContent(contentId);
  if (!content) notFound();
  const playbackUrl =
    typeof content.metadata.playback_url === "string"
      ? content.metadata.playback_url
      : null;
  const provider =
    content.metadata.provider === "youtube" ||
    content.metadata.provider === "vimeo" ||
    content.metadata.provider === "loom"
      ? content.metadata.provider
      : "html5";

  if (content.item.sourceType === "docs" && content.item.kind === "video") {
    if (!playbackUrl) notFound();
    return (
      <PageShell
        variant="content"
        title={content.item.title}
        description={content.item.summary ?? "Training video"}
        breadcrumbs={[
          { label: "Training", href: "/training" },
          { label: "Library", href: "/training/library" },
          { label: content.item.title },
        ]}
      >
        <section className="space-y-4">
          <SectionRuleHeading label="Watch" />
          <div className="aspect-video overflow-hidden rounded-lg border border-border bg-foreground">
            <TrackedVideoPlayer
              contentItemId={content.item.id}
              title={content.item.title}
              url={playbackUrl}
              provider={provider}
            />
          </div>
          {content.item.sourceUrl ? (
            <a
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline sm:min-h-9"
              href={attributedDocsHref(content.item.sourceUrl)}
              target="_blank"
              rel="noreferrer"
            >
              View documentation source
            </a>
          ) : null}
        </section>
      </PageShell>
    );
  }
  if (!content.body) redirect(content.item.href);
  return (
    <PageShell
      variant="content"
      title={content.item.title}
      description={content.item.summary ?? undefined}
      breadcrumbs={[
        { label: "Training", href: "/training" },
        { label: "Library", href: "/training/library" },
        { label: content.item.title },
      ]}
    >
      <MarkdownRenderer content={content.body} />
    </PageShell>
  );
}
