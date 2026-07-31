"use client";

import { BookOpen, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { useTrainingDocs } from "@/hooks/use-training-docs";
import type { TrainingDocStep } from "@/lib/training-docs/types";

export function TrainingDocPreviewClient({ docId }: { docId: string }) {
  const router = useRouter();
  const { data: docs = [], isLoading } = useTrainingDocs();
  const doc = docs.find((item) => item.id === docId);

  if (isLoading) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading training page...
      </div>
    );
  }

  if (!doc) {
    return (
      <EmptyState
        icon={<BookOpen className="h-5 w-5" />}
        title="Training page not found"
        description="Return to the table and open an existing training doc."
        action={
          <Button onClick={() => router.push("/training-docs")}>
            Back to Training Docs
          </Button>
        }
      />
    );
  }

  const bodyMarkdown = doc.steps.length
    ? stripGeneratedManualSections(doc.body_markdown)
    : doc.body_markdown;

  return (
    <article className="max-w-5xl space-y-8">
      <style>{`
        [data-admin-feedback-root],
        [data-velt-root],
        [class*="Velt"],
        [class*="velt"],
        [class*="styles-module__toolbar"],
        [class*="styles-module__fixedMarkersLayer"],
        .cdk-overlay-container,
        .global-ai-widget-launcher {
          display: none !important;
        }
      `}</style>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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

      {bodyMarkdown.trim() ? <ManualMarkdown markdown={bodyMarkdown} /> : null}

      {doc.steps.length ? (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Steps</h2>
          <div className="space-y-10">
            {doc.steps
              .slice()
              .sort((left, right) => left.step_order - right.step_order)
              .map((step, index) => (
                <section key={step.id} className="space-y-4">
                  <div className="max-w-3xl space-y-3">
                    <div className="space-y-1">
                      <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                        Step {index + 1}
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        {step.title}
                      </h3>
                    </div>
                    <StepInstruction step={step} />

                    {step.expected_result ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Expected result:
                        </span>{" "}
                        {step.expected_result}
                      </p>
                    ) : null}
                  </div>

                  {step.screenshot_asset?.signed_url ? (
                    <figure className="space-y-2">
                      <img
                        src={step.screenshot_asset.signed_url}
                        alt={
                          step.screenshot_asset.alt_text ??
                          step.screenshot_asset.file_name
                        }
                        className="w-full rounded-md border object-contain"
                      />
                      {step.screenshot_asset.caption ? (
                        <figcaption className="text-sm text-muted-foreground">
                          {step.screenshot_asset.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}
                </section>
              ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function ManualMarkdown({ markdown }: { markdown: string }) {
  const sections = parseMarkdownSections(markdown);
  return (
    <section className="max-w-3xl space-y-5">
      {sections.map((section) => (
        <div key={section.heading} className="space-y-2">
          {section.heading ? (
            <h2 className="text-base font-semibold text-foreground">
              {section.heading}
            </h2>
          ) : null}
          <div className="space-y-2 text-sm leading-6 text-foreground">
            {section.blocks.map((block) =>
              block.kind === "list" ? (
                <ul
                  key={block.items.join("|")}
                  className="list-disc space-y-1 pl-5"
                >
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={block.text}>{block.text}</p>
              ),
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function StepInstruction({ step }: { step: TrainingDocStep }) {
  const generatedList = getGeneratedList(step);
  const instructionIntro = stripMarkdownList(step.instruction_markdown);

  return (
    <div className="space-y-3">
      {instructionIntro ? (
        <p className="text-sm leading-6 text-foreground">{instructionIntro}</p>
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

function parseMarkdownSections(markdown: string): Array<{
  heading: string;
  blocks: Array<
    { kind: "paragraph"; text: string } | { kind: "list"; items: string[] }
  >;
}> {
  const sections: Array<{
    heading: string;
    lines: string[];
  }> = [];
  let current = { heading: "", lines: [] as string[] };

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      if (current.heading || current.lines.some((item) => item.trim())) {
        sections.push(current);
      }
      current = { heading: heading[1].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }

  if (current.heading || current.lines.some((item) => item.trim())) {
    sections.push(current);
  }

  return sections.map((section) => ({
    heading: section.heading,
    blocks: parseMarkdownBlocks(section.lines),
  }));
}

function parseMarkdownBlocks(
  lines: string[],
): Array<
  { kind: "paragraph"; text: string } | { kind: "list"; items: string[] }
> {
  const blocks: Array<
    { kind: "paragraph"; text: string } | { kind: "list"; items: string[] }
  > = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ kind: "paragraph", text });
    paragraph = [];
  }

  function flushList() {
    if (list.length) blocks.push({ kind: "list", items: list });
    list = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  return blocks;
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
