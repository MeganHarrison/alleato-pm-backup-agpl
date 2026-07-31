import { notFound } from "next/navigation";

import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { PageShell } from "@/components/layout";
import {
  getTrainingGuideBySlug,
  TRAINING_GUIDE_SLUGS,
} from "@/content/training-guides/catalog";
import { getTrainingDocToolCategory } from "@/features/knowledge/app-knowledge";
import { AppTrainingDocPage } from "@/features/knowledge/app-training-doc-page";
import {
  getTrainingPageShellProps,
  GuideViewer,
  TrainingPageContent,
} from "@/features/training";
import { createServiceClient } from "@/lib/supabase/service";
import { getPublishedTrainingDocBySlug } from "@/lib/training-docs/server";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return TRAINING_GUIDE_SLUGS.map((guideSlug) => ({ guideSlug }));
}

export default async function TrainingGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ guideSlug: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ guideSlug }, { mode: requestedMode }] = await Promise.all([
    params,
    searchParams,
  ]);
  const guide = await getTrainingGuideBySlug(guideSlug);
  if (guide) {
    return (
      <PageShell
        {...getTrainingPageShellProps({
          title: guide.title,
          description: guide.description,
        })}
      >
        <TrainingPageContent>
          <GuideViewer
            guide={guide}
            showHeader={false}
            content={
              <MarkdownRenderer content={guide.body} className="prose-sm" />
            }
          />
        </TrainingPageContent>
      </PageShell>
    );
  }

  const doc = await getPublishedTrainingDocBySlug(
    createServiceClient(),
    guideSlug,
  );
  if (!doc) notFound();

  const publishedDoc = {
    title: doc.title,
    slug: doc.slug,
    summary: doc.summary,
    audience: doc.audience,
    status: doc.status,
    sourceRoute: doc.source_route,
    publishedDocPath: doc.published_doc_path!,
    lastPublishedAt: doc.last_published_at,
    appToolCategory:
      typeof doc.metadata.appToolCategory === "string"
        ? doc.metadata.appToolCategory
        : null,
  };
  const category = getTrainingDocToolCategory(publishedDoc);
  const experienceMode =
    requestedMode === "annotated" || requestedMode === "walkthrough"
      ? requestedMode
      : "article";
  const experiencePath = `/training/guides/${doc.slug}`;

  return (
    <PageShell
      variant="detailWide"
      title={doc.title}
      showHeader={false}
      contentClassName="mx-auto max-w-screen-2xl"
    >
      <AppTrainingDocPage
        activeCategorySlug={category?.slug}
        backHref="/training/library"
        backLabel="Training library"
        doc={doc}
        experienceMode={experienceMode}
        experiencePath={experiencePath}
      />
    </PageShell>
  );
}
