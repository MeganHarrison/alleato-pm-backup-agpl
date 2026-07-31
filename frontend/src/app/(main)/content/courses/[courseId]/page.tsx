import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/layout";
import { SectionRuleHeading } from "@/components/layout/spacing";
import { getLearningCatalog, getLearningCourseForManagement } from "@/lib/learning/server";
import { requireTrainingReviewerPageAccess } from "@/lib/training/reviewer-access";

import {
  addCourseItemAction,
  addCourseSectionAction,
  publishCourseAction,
  removeCourseItemAction,
} from "../../actions";

export default async function CourseBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ error?: string; published?: string }>;
}) {
  await requireTrainingReviewerPageAccess();
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const [course, catalog] = await Promise.all([
    getLearningCourseForManagement(courseId),
    getLearningCatalog(),
  ]);
  if (!course) notFound();
  const eligibleItems = catalog.filter(
    (item) =>
      item.lifecycle === "published" &&
      item.id !== course.contentItemId &&
      item.kind !== "internal_course",
  );
  return (
    <PageShell
      variant="detailWide"
      title={course.title}
      description={course.outcome}
      statusBadge={
        <span className="text-sm capitalize text-muted-foreground">
          {course.lifecycle.replaceAll("_", " ")}
        </span>
      }
      breadcrumbs={[
        { label: "Content Studio", href: "/content" },
        { label: "Course builder" },
      ]}
      actions={
        course.lifecycle === "published" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/training/courses/${course.slug}`}>Preview course</Link>
          </Button>
        ) : (
          <form action={publishCourseAction}>
            <input type="hidden" name="courseId" value={course.id} />
            <Button type="submit" size="sm">Publish course</Button>
          </form>
        )
      }
    >
      {query.error ? (
        <Alert variant="destructive">
          <AlertDescription>{query.error}</AlertDescription>
        </Alert>
      ) : null}
      {query.published ? (
        <Alert variant="success">
          <AlertDescription>The course is published and available in the training library.</AlertDescription>
        </Alert>
      ) : null}
      {course.publicationBlockers.length > 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            Before publishing: {course.publicationBlockers.join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-10">
          {course.sections.map((section, sectionIndex) => (
            <section key={section.id} className="space-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Module {sectionIndex + 1}
                </p>
                <SectionRuleHeading label={section.title} className="mt-1" />
              </div>
              {section.items.length > 0 ? (
                <ol className="divide-y">
                  {section.items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 py-4">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.kind.replaceAll("_", " ")}
                          {item.estimatedMinutes ? ` · ${item.estimatedMinutes} min` : ""}
                        </p>
                      </div>
                      {course.lifecycle !== "published" ? (
                        <form action={removeCourseItemAction}>
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm">Remove</Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No learning items in this module yet.</p>
              )}
              {course.lifecycle !== "published" ? (
                <form action={addCourseItemAction} className="flex flex-col gap-3 sm:flex-row">
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="sectionId" value={section.id} />
                  <select
                    name="contentItemId"
                    required
                    className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choose published content</option>
                    {eligibleItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.kind.replaceAll("_", " ")})
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline">Add item</Button>
                </form>
              ) : null}
            </section>
          ))}
        </div>
        <aside className="space-y-6 lg:border-l lg:pl-8">
          <div>
            <SectionRuleHeading label="Course settings" />
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Estimated time</dt>
                <dd>{course.estimatedMinutes ?? "Not set"} min</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Completion</dt>
                <dd className="text-right">{course.completionRule.replaceAll("_", " ")}</dd>
              </div>
            </dl>
          </div>
          {course.lifecycle !== "published" ? (
            <form action={addCourseSectionAction} className="space-y-3">
              <input type="hidden" name="courseId" value={course.id} />
              <Label htmlFor="title">New module</Label>
              <Input id="title" name="title" placeholder="Module title" required />
              <Button type="submit" variant="outline" className="w-full">Add module</Button>
            </form>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
