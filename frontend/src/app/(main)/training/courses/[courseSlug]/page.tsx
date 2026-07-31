import Link from "next/link";
import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  getLearnerAssignments,
  getLearningCourseBySlug,
} from "@/lib/learning/server";

import { startCourseAction } from "../../actions";

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const [course, assignments] = await Promise.all([
    getLearningCourseBySlug(courseSlug),
    getLearnerAssignments(),
  ]);
  if (!course) notFound();
  const enrollment = assignments.find((item) => item.courseId === course.id);
  return (
    <PageShell
      variant="detail"
      title={course.title}
      description={course.summary ?? course.outcome}
      breadcrumbs={[
        { label: "Training", href: "/training" },
        { label: "Library", href: "/training/library" },
        { label: course.title },
      ]}
      actions={
        enrollment?.status === "completed" ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/training/learn/${enrollment.enrollmentId}`}>Review course</Link>
          </Button>
        ) : (
          <form action={startCourseAction}>
            <input type="hidden" name="courseId" value={course.id} />
            {enrollment ? <input type="hidden" name="enrollmentId" value={enrollment.enrollmentId} /> : null}
            <Button type="submit" size="sm">
              {enrollment?.startedAt ? "Continue course" : "Start course"}
            </Button>
          </form>
        )
      }
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold">What you will be able to do</h2>
            <p className="mt-2 leading-7 text-muted-foreground">{course.outcome}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Course outline</h2>
            <ol className="mt-4 divide-y border-y">
              {course.sections.map((section, index) => (
                <li key={section.id} className="py-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Module {index + 1}
                  </p>
                  <h3 className="mt-1 font-medium">{section.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {section.items.length} learning item{section.items.length === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-3 text-sm lg:border-l lg:pl-8">
          <p><span className="text-muted-foreground">Time:</span> {course.estimatedMinutes ?? "Varies"} minutes</p>
          <p><span className="text-muted-foreground">Level:</span> {course.difficulty ?? "All levels"}</p>
          {course.prerequisites ? (
            <p><span className="text-muted-foreground">Before you start:</span> {course.prerequisites}</p>
          ) : null}
        </aside>
      </div>
    </PageShell>
  );
}
