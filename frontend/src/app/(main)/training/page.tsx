export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, BookOpen, ChartNoAxesCombined, Search } from "lucide-react";

import { PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  canCurrentUserManageLearning,
  getLearnerAssignments,
} from "@/lib/learning/server";

export default async function TrainingHomePage() {
  const [assignments, canManage] = await Promise.all([
    getLearnerAssignments(),
    canCurrentUserManageLearning(),
  ]);
  const active = assignments.filter(
    (assignment) => !["completed", "waived", "cancelled"].includes(assignment.status),
  );
  return (
    <PageShell
      variant="detailWide"
      title="Training"
      description="Continue required learning, build role skills, or find help for the work in front of you."
      actions={
        canManage ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/training/manage">Manage training</Link>
          </Button>
        ) : undefined
      }
    >
      <section aria-labelledby="assigned-learning" className="max-w-5xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="assigned-learning" className="text-lg font-semibold">Your learning</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Required and recommended courses assigned to you.
            </p>
          </div>
        </div>
        {active.length > 0 ? (
          <div className="mt-4 divide-y border-y">
            {active.map((assignment) => (
              <Link
                key={assignment.enrollmentId}
                href={
                  assignment.status === "in_progress" || assignment.status === "overdue"
                    ? `/training/learn/${assignment.enrollmentId}`
                    : `/training/courses/${assignment.courseSlug}`
                }
                className="flex items-center gap-5 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-medium">{assignment.title}</h3>
                    <span className="text-xs capitalize text-muted-foreground">
                      {assignment.requirement}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {assignment.status === "assigned"
                      ? "Ready to start"
                      : `${assignment.progressPercent}% complete`}
                    {assignment.dueAt
                      ? ` · Due ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(assignment.dueAt))}`
                      : ""}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 border-y py-8 text-sm text-muted-foreground">
            You have no active assignments. Use the library to continue growing.
          </p>
        )}
      </section>

      <section aria-labelledby="training-tools">
        <h2 id="training-tools" className="text-lg font-semibold">Explore</h2>
        <div className="mt-4 grid max-w-5xl gap-x-10 sm:grid-cols-3">
          <TrainingLink
            href="/training/library"
            title="Training Library"
            description="Guides, SOPs, courses, and resources."
            icon={BookOpen}
          />
          <TrainingLink
            href="/training/growth"
            title="My Growth"
            description="Assess skills and plan professional development."
            icon={ChartNoAxesCombined}
          />
          <TrainingLink
            href="/ai?prompt=Help%20me%20find%20the%20right%20training%20or%20company%20resource"
            title="Ask the library"
            description="Get help finding the right company knowledge."
            icon={Search}
          />
        </div>
      </section>
    </PageShell>
  );
}

function TrainingLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
}) {
  return (
    <Link href={href} className="flex gap-3 border-b py-5">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}
