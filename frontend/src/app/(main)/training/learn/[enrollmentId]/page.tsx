import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";

import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { attributedDocsHref } from "@/lib/analytics/docs-link";
import { getLearnerCourse } from "@/lib/learning/server";

import { completeLearningItemAction } from "../../actions";

export default async function LearningRunnerPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;
  const course = await getLearnerCourse(enrollmentId);
  if (!course || !("enrollment" in course)) notFound();
  const items = course.sections.flatMap((section) => section.items);
  const current =
    items.find((item) => item.required && item.progressStatus !== "completed") ??
    items[0];
  if (!current) notFound();
  return (
    <PageShell
      variant="detailWide"
      title={course.title}
      description={`${course.enrollment.progressPercent}% complete`}
      breadcrumbs={[
        { label: "Training", href: "/training" },
        { label: course.title },
      ]}
    >
      <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <nav aria-label="Course outline" className="lg:border-r lg:pr-8">
          <ol className="space-y-6">
            {course.sections.map((section) => (
              <li key={section.id}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
                <ol className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <li key={item.id} className="flex gap-2 text-sm">
                      {item.progressStatus === "completed" ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                      )}
                      <span className={item.id === current.id ? "font-medium" : "text-muted-foreground"}>
                        {item.title}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </nav>
        <article className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {current.kind.replaceAll("_", " ")}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{current.title}</h2>
          {current.instructions ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{current.instructions}</p>
          ) : null}
          <div className="mt-8">
            {current.nativeBody ? (
              <MarkdownRenderer content={current.nativeBody} />
            ) : (
              <div className="border-y py-8">
                <p className="text-sm text-muted-foreground">
                  Open the source material, complete it, then return here to record your progress.
                </p>
                {current.sourceUrl ? (
                  <Button asChild className="mt-4">
                    <a href={attributedDocsHref(current.sourceUrl)} target={current.sourceUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                      Open learning material
                    </a>
                  </Button>
                ) : (
                  <Button asChild className="mt-4">
                    <Link href={current.href}>Open learning material</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
          {current.progressStatus !== "completed" ? (
            <form action={completeLearningItemAction} className="mt-10 flex justify-end border-t pt-6">
              <input type="hidden" name="enrollmentId" value={enrollmentId} />
              <input type="hidden" name="courseItemId" value={current.id} />
              <Button type="submit">Mark complete</Button>
            </form>
          ) : null}
        </article>
      </div>
    </PageShell>
  );
}
