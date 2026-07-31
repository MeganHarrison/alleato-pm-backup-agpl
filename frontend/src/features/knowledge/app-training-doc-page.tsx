import Link from "next/link";

import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { SectionRuleHeading } from "@/components/layout";
import { Button } from "@/components/ui/button";
import type { TrainingDocStep, TrainingDocWithAssets } from "@/lib/training-docs/types";
import { cn } from "@/lib/utils";
import { AppKnowledgeToolNav } from "./app-knowledge-tool-nav";
import {
  type TrainingDocExperienceMode,
  TrainingDocExperience,
} from "./training-doc-experience";

export function AppTrainingDocPage({
  activeCategorySlug,
  backHref,
  backLabel,
  doc,
  experienceMode = "article",
  experiencePath,
}: {
  activeCategorySlug?: string | null;
  backHref: string;
  backLabel: string;
  doc: TrainingDocWithAssets;
  experienceMode?: "article" | TrainingDocExperienceMode;
  experiencePath?: string;
}) {
  const bodyMarkdown = prepareTrainingDocBodyMarkdown(doc);
  const sortedSteps = doc.steps
    .slice()
    .sort((left, right) => left.step_order - right.step_order);
  const walkthroughVideo = doc.assets.find(
    (asset) => asset.asset_type === "video" || asset.mime_type.startsWith("video/"),
  );

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground">
      <div className="mx-auto grid max-w-screen-2xl gap-10 px-6 pb-10 pt-8 lg:grid-cols-[15rem_minmax(0,56rem)_13rem] lg:px-10 xl:gap-14">
        <AppKnowledgeToolNav activeSlug={activeCategorySlug} />

        <main className="min-w-0 space-y-10">
          <header id="overview" className="space-y-4">
            <Button asChild variant="ghost" size="sm" className="px-0 lg:hidden">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-primary">App Training</p>
              <h1 className="text-4xl font-semibold tracking-normal text-foreground">
                {doc.title}
              </h1>
              {doc.summary ? (
                <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                  {doc.summary}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{doc.status.replace("_", " ")}</span>
              {doc.source_route ? <span>{doc.source_route}</span> : null}
              {doc.last_published_at ? (
                <span>
                  Published{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(doc.last_published_at))}
                </span>
              ) : null}
            </div>
            {experiencePath && sortedSteps.length ? (
              <nav aria-label="Training document view" className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant={experienceMode === "article" ? "secondary" : "ghost"}>
                  <Link href={experiencePath}>Article</Link>
                </Button>
                <Button asChild size="sm" variant={experienceMode === "annotated" ? "secondary" : "ghost"}>
                  <Link href={`${experiencePath}?mode=annotated`}>Annotated</Link>
                </Button>
                <Button asChild size="sm" variant={experienceMode === "walkthrough" ? "secondary" : "ghost"}>
                  <Link href={`${experiencePath}?mode=walkthrough`}>Guide me</Link>
                </Button>
              </nav>
            ) : null}
          </header>

          {bodyMarkdown.trim() ? (
            <section id="details" className="space-y-5">
              <SectionRuleHeading label="Details" />
              <MarkdownRenderer content={bodyMarkdown} />
            </section>
          ) : null}

          {walkthroughVideo?.signed_url ? (
            <section id="walkthrough-video" className="space-y-5">
              <SectionRuleHeading label="Walkthrough Video" />
              <figure className="space-y-2">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full rounded-md border border-border bg-foreground"
                >
                  <source
                    src={walkthroughVideo.signed_url}
                    type={walkthroughVideo.mime_type}
                  />
                </video>
                {walkthroughVideo.caption ? (
                  <figcaption className="text-sm text-muted-foreground">
                    {walkthroughVideo.caption}
                  </figcaption>
                ) : null}
              </figure>
            </section>
          ) : null}

          {sortedSteps.length ? (
            <section id="steps" className="space-y-6">
              <SectionRuleHeading label="Steps" />
              {experienceMode === "article" ? (
                <div className="space-y-10">
                  {sortedSteps.map((step, index) => (
                    <TrainingDocStepBlock key={step.id} index={index} step={step} />
                  ))}
                </div>
              ) : (
                <TrainingDocExperience
                  articleHref={experiencePath ?? backHref}
                  mode={experienceMode}
                  steps={sortedSteps}
                />
              )}
            </section>
          ) : null}
        </main>

        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-6 space-y-3 text-sm">
            <Button asChild variant="ghost" size="sm" className="justify-start px-0">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
            <div className="space-y-2">
              <a href="#overview" className="block font-medium text-primary">
                Overview
              </a>
              {bodyMarkdown.trim() ? (
                <a href="#details" className="block text-muted-foreground hover:text-primary">
                  Details
                </a>
              ) : null}
              {walkthroughVideo?.signed_url ? (
                <a href="#walkthrough-video" className="block text-muted-foreground hover:text-primary">
                  Walkthrough Video
                </a>
              ) : null}
              {sortedSteps.length ? (
                <a href="#steps" className="block text-muted-foreground hover:text-primary">
                  Steps
                </a>
              ) : null}
            </div>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function TrainingDocStepBlock({
  index,
  step,
}: {
  index: number;
  step: TrainingDocStep;
}) {
  return (
    <section className="space-y-4">
      <div className="max-w-3xl space-y-3">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Step {index + 1}
          </div>
          <div className="text-base font-semibold text-foreground">{step.title}</div>
        </div>
        <StepInstruction step={step} />
        {step.expected_result ? (
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Expected result:</span>{" "}
            {step.expected_result}
          </p>
        ) : null}
      </div>

      {step.screenshot_asset?.signed_url ? (
        <figure className="space-y-2">
          <img
            src={step.screenshot_asset.signed_url}
            alt={step.screenshot_asset.alt_text ?? step.screenshot_asset.file_name}
            className="w-full rounded-md border border-border object-contain"
          />
          {step.screenshot_asset.caption ? (
            <figcaption className="text-sm text-muted-foreground">
              {step.screenshot_asset.caption}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </section>
  );
}

function StepInstruction({ step }: { step: TrainingDocStep }) {
  const generatedList = getGeneratedList(step);
  const instructionIntro = stripMarkdownList(step.instruction_markdown);

  return (
    <div className="space-y-3">
      {instructionIntro ? (
        <p className="text-sm leading-6 text-foreground">
          {formatInlineMarkdown(instructionIntro)}
        </p>
      ) : null}
      {generatedList.length ? (
        <ul className="grid list-disc gap-x-8 gap-y-1 pl-5 text-sm leading-6 text-foreground sm:grid-cols-2 lg:grid-cols-3">
          {generatedList.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function getGeneratedList(step: TrainingDocStep): string[] {
  const metadata = step.action_metadata;
  const labels = metadata.labels;
  if (Array.isArray(labels)) {
    return labels.filter((item): item is string => typeof item === "string");
  }

  const buttons = metadata.buttons;
  if (Array.isArray(buttons)) {
    return buttons.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function stripMarkdownList(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("- "))
    .join("\n")
    .trim();
}

function stripGeneratedManualSections(markdown: string): string {
  return markdown
    .replace(/\n?## Steps\n[\s\S]*?(?=\n##\s|$)/, "\n")
    .replace(/\n?## Quality Check\n[\s\S]*?(?=\n##\s|$)/, "\n")
    .replace(/\n?## Common Issues\n[\s\S]*?(?=\n##\s|$)/, "\n")
    .trim();
}

function prepareTrainingDocBodyMarkdown(doc: TrainingDocWithAssets): string {
  const withoutManualSections = doc.steps.length
    ? stripGeneratedManualSections(doc.body_markdown)
    : doc.body_markdown;

  return stripGeneratedOverview(withoutManualSections, doc.title, doc.summary);
}

function stripGeneratedOverview(
  markdown: string,
  title: string,
  summary: string | null,
): string {
  const lines = markdown.split("\n");
  let startIndex = 0;

  while (startIndex < lines.length && !lines[startIndex]?.trim()) {
    startIndex += 1;
  }

  const firstLine = lines[startIndex]?.trim();
  if (!firstLine || !firstLine.startsWith("# ")) {
    return markdown.trim();
  }

  const headingText = normalizeMarkdownText(firstLine.replace(/^#\s+/, ""));
  if (headingText !== normalizeMarkdownText(title)) {
    return markdown.trim();
  }

  let nextIndex = startIndex + 1;
  while (nextIndex < lines.length && !lines[nextIndex]?.trim()) {
    nextIndex += 1;
  }

  const summaryText = summary ? normalizeMarkdownText(summary) : "";
  if (
    summaryText &&
    normalizeMarkdownText(lines[nextIndex]?.trim() ?? "") === summaryText
  ) {
    nextIndex += 1;
  }

  return lines.slice(nextIndex).join("\n").trim();
}

function normalizeMarkdownText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[*_`]/g, "")
    .trim()
    .toLowerCase();
}

function formatInlineMarkdown(value: string) {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className={cn("rounded bg-muted px-1 py-0.5 text-[0.9em] text-foreground")}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
